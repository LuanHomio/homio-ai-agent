// Runtime de agent_actions: builder de function_declarations pro Gemini
// + executors por tipo. Cada agent_action ativa vira 1 function_declaration
// dinamico no array tools[]; quando o LLM chama functionCall, o roteador
// mapeia pro handler correspondente.
//
// 7 dos 9 tipos implementados. appointmentBooking e advancedFollowup
// retornam not_implemented (TODO em PR futuro).

import { GHL_API_URL, getLocationToken } from "./ghl-auth.ts";

// =====================================================
// Types
// =====================================================

export type ActionRow = {
  id: string;
  agent_id: string;
  action_type: string;
  name: string;
  description: string | null;
  config: Record<string, any>;
  is_active: boolean;
  sort_order: number;
};

export type ActionContext = {
  supabaseClient: any;
  locationId: string;
  contactId: string;
  conversationId: string;
  agentId: string;
};

export type ToolDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
};

type ActionHandler = {
  buildDeclaration(action: ActionRow): ToolDeclaration;
  execute(action: ActionRow, args: Record<string, any>, ctx: ActionContext): Promise<any>;
};

// =====================================================
// Helpers
// =====================================================

/** Converte UUID em nome valido pra Gemini function_declaration (so [a-zA-Z0-9_]). */
export function fnNameForAction(action: ActionRow): string {
  return `action_${action.id.replace(/-/g, "_")}`;
}

async function ghlFetch(
  ctx: ActionContext,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await getLocationToken(ctx.supabaseClient, ctx.locationId);
  const res = await fetch(`${GHL_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Version: "2021-07-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Helper pra buildar properties dos custom fields editaveis pelo agent. */
function customFieldsParam(): any {
  return {
    type: "array",
    description:
      "Lista de custom fields a preencher/atualizar. Cada item: { id: customFieldId, value: valorString }.",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        value: { type: "string" },
      },
      required: ["id", "value"],
    },
  };
}

// =====================================================
// Handlers
// =====================================================

const triggerWorkflow: ActionHandler = {
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.triggerCondition}. Examples: ${(action.config.examples ?? []).join(" | ")}.`,
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Motivo curto pelo qual disparou (registro/log)",
          },
        },
        required: [],
      },
    };
  },
  async execute(action, _args, ctx) {
    const workflowIds: string[] = action.config.workflowIds ?? [];
    const results = [];
    for (const wfId of workflowIds) {
      const r = await ghlFetch(ctx, `/contacts/${ctx.contactId}/workflow/${wfId}`, {
        method: "POST",
      });
      results.push({ workflowId: wfId, ok: r.ok, status: r.status });
    }
    return { success: results.every((r) => r.ok), workflows: results };
  },
};

const updateContactField: ActionHandler = {
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.description}. Trigger: ${(action.config.examples ?? []).join(" | ")}.`,
      parameters: {
        type: "object",
        properties: {
          value: {
            type: "string",
            description: "O valor coletado/inferido da conversa pra gravar no campo",
          },
        },
        required: ["value"],
      },
    };
  },
  async execute(action, args, ctx) {
    const fieldId: string = action.config.contactFieldId;
    const value = String(args.value ?? "");
    const r = await ghlFetch(ctx, `/contacts/${ctx.contactId}`, {
      method: "PUT",
      body: JSON.stringify({
        customFields: [{ id: fieldId, field_value: value }],
      }),
    });
    return { success: r.ok, status: r.status, fieldId, value };
  },
};

const stopBot: ActionHandler = {
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.stopBotTriggerCondition}. Examples: ${(action.config.stopBotExamples ?? []).join(" | ")}.`,
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    };
  },
  async execute(action, _args, ctx) {
    await ctx.supabaseClient
      .from("conversations")
      .update({ agent_enabled: false, updated_at: new Date().toISOString() })
      .eq("conversation_id", ctx.conversationId);
    return {
      success: true,
      botStopped: true,
      finalMessage: action.config.finalMessage,
      instruction: `Envie EXATAMENTE esta mensagem ao usuario como mensagem final: "${action.config.finalMessage}"`,
    };
  },
};

const humanHandOver: ActionHandler = {
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.triggerCondition}. Examples: ${(action.config.examples ?? []).join(" | ")}.`,
      parameters: { type: "object", properties: {}, required: [] },
    };
  },
  async execute(action, _args, ctx) {
    // 1. Tags + assignedTo no contato
    const updates: any = {};
    if (Array.isArray(action.config.tags) && action.config.tags.length > 0) {
      updates.tags = action.config.tags;
    }
    if (action.config.assignedToUserId && !action.config.skipAssignToUser) {
      updates.assignedTo = action.config.assignedToUserId;
    }

    if (Object.keys(updates).length > 0) {
      await ghlFetch(ctx, `/contacts/${ctx.contactId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    }

    // 2. Pausa o bot na conversa
    await ctx.supabaseClient
      .from("conversations")
      .update({ agent_enabled: false, updated_at: new Date().toISOString() })
      .eq("conversation_id", ctx.conversationId);

    return {
      success: true,
      handover: true,
      finalMessage: action.config.finalMessage,
      instruction: `Envie EXATAMENTE esta mensagem ao usuario: "${action.config.finalMessage}". O atendimento foi transferido para humano.`,
    };
  },
};

const transferBot: ActionHandler = {
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.transferBotTriggerCondition}. Examples: ${(action.config.transferBotExamples ?? []).join(" | ")}.`,
      parameters: { type: "object", properties: {}, required: [] },
    };
  },
  async execute(action, _args, ctx) {
    const targetAgentId: string = action.config.transferToBot;
    await ctx.supabaseClient
      .from("conversations")
      .update({ agent_id: targetAgentId, updated_at: new Date().toISOString() })
      .eq("conversation_id", ctx.conversationId);
    return {
      success: true,
      transferred: true,
      newAgentId: targetAgentId,
      instruction:
        "A conversa foi transferida pra outro agent. Encerre sua resposta de forma educada (curta).",
    };
  },
};

const createOpportunity: ActionHandler = {
  buildDeclaration(action) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (action.config.collectMonetaryValue) {
      properties.monetaryValue = {
        type: "number",
        description: "Valor monetario estimado pra essa opportunity (em BRL)",
      };
    }
    if (
      Array.isArray(action.config.agentEditableCustomFieldIds) &&
      action.config.agentEditableCustomFieldIds.length > 0
    ) {
      properties.customFields = customFieldsParam();
    }

    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.triggerCondition}. Examples: ${(action.config.examples ?? []).join(" | ")}.`,
      parameters: { type: "object", properties, required },
    };
  },
  async execute(action, args, ctx) {
    // Pega nome do contato pra usar como nome da opp
    const contactRes = await ghlFetch(ctx, `/contacts/${ctx.contactId}`);
    const contactName =
      contactRes.data?.contact?.contactName ||
      contactRes.data?.contact?.name ||
      [contactRes.data?.contact?.firstName, contactRes.data?.contact?.lastName]
        .filter(Boolean)
        .join(" ") ||
      "Lead";

    const allowedCfIds = new Set<string>(action.config.agentEditableCustomFieldIds ?? []);
    const filteredCustomFields = Array.isArray(args.customFields)
      ? args.customFields
          .filter((cf: any) => cf?.id && allowedCfIds.has(cf.id))
          .map((cf: any) => ({ id: cf.id, field_value: String(cf.value) }))
      : [];

    const body: any = {
      pipelineId: action.config.pipelineId,
      pipelineStageId: action.config.pipelineStageId,
      locationId: ctx.locationId,
      contactId: ctx.contactId,
      name: contactName,
      status: "open",
    };
    if (action.config.source) body.source = action.config.source;
    if (action.config.assignedToUserId) body.assignedTo = action.config.assignedToUserId;
    if (action.config.collectMonetaryValue && typeof args.monetaryValue === "number") {
      body.monetaryValue = args.monetaryValue;
    }
    if (filteredCustomFields.length > 0) body.customFields = filteredCustomFields;

    const r = await ghlFetch(ctx, `/opportunities/`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      success: r.ok,
      status: r.status,
      opportunityId: r.data?.opportunity?.id ?? r.data?.id,
      opportunityName: contactName,
      pipelineId: action.config.pipelineId,
      pipelineStageId: action.config.pipelineStageId,
      error: r.ok ? undefined : r.data?.message ?? "Failed to create opportunity",
    };
  },
};

const updateOpportunity: ActionHandler = {
  buildDeclaration(action) {
    const properties: Record<string, any> = {};

    if (action.config.canMoveStage) {
      properties.pipelineStageId = {
        type: "string",
        description: "Novo pipelineStageId para mover a opp",
      };
    }
    if (action.config.canChangeStatus) {
      properties.status = {
        type: "string",
        enum: ["open", "won", "lost", "abandoned"],
        description: "Novo status da opp",
      };
    }
    if (action.config.canUpdateMonetaryValue) {
      properties.monetaryValue = {
        type: "number",
        description: "Novo valor monetario (BRL)",
      };
    }
    if (action.config.canReassign) {
      properties.assignedTo = {
        type: "string",
        description: "User ID GHL pra atribuir a opp",
      };
    }
    if (
      Array.isArray(action.config.agentEditableCustomFieldIds) &&
      action.config.agentEditableCustomFieldIds.length > 0
    ) {
      properties.customFields = customFieldsParam();
    }

    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${action.config.triggerCondition}. Examples: ${(action.config.examples ?? []).join(" | ")}.`,
      parameters: { type: "object", properties, required: [] },
    };
  },
  async execute(action, args, ctx) {
    // 1. Busca a opp mais recente do contato (qualquer pipeline/status)
    const search = await ghlFetch(
      ctx,
      `/opportunities/search?location_id=${encodeURIComponent(ctx.locationId)}&contact_id=${encodeURIComponent(ctx.contactId)}`,
    );
    if (!search.ok) {
      return { success: false, error: `Opportunity search failed: ${search.status}` };
    }
    const opps: any[] = search.data?.opportunities ?? [];
    if (opps.length === 0) {
      return { success: false, error: "Nenhuma opportunity encontrada para esse contato" };
    }
    const sorted = [...opps].sort((a, b) => {
      const da = new Date(a.updatedAt || a.dateUpdated || a.createdAt || 0).getTime();
      const db = new Date(b.updatedAt || b.dateUpdated || b.createdAt || 0).getTime();
      return db - da;
    });
    const opp = sorted[0];

    // 2. Monta body com so os campos permitidos pela config
    const body: any = {};
    if (action.config.canMoveStage && args.pipelineStageId) {
      body.pipelineStageId = args.pipelineStageId;
    }
    if (action.config.canChangeStatus && args.status) {
      body.status = args.status;
    }
    if (action.config.canUpdateMonetaryValue && typeof args.monetaryValue === "number") {
      body.monetaryValue = args.monetaryValue;
    }
    if (action.config.canReassign && args.assignedTo) {
      body.assignedTo = args.assignedTo;
    }
    const allowedCfIds = new Set<string>(action.config.agentEditableCustomFieldIds ?? []);
    if (Array.isArray(args.customFields) && allowedCfIds.size > 0) {
      const cfs = args.customFields
        .filter((cf: any) => cf?.id && allowedCfIds.has(cf.id))
        .map((cf: any) => ({ id: cf.id, field_value: String(cf.value) }));
      if (cfs.length > 0) body.customFields = cfs;
    }

    if (Object.keys(body).length === 0) {
      return { success: false, error: "Nenhum campo para atualizar (config restrita)" };
    }

    const r = await ghlFetch(ctx, `/opportunities/${opp.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      success: r.ok,
      status: r.status,
      opportunityId: opp.id,
      updated: body,
      error: r.ok ? undefined : r.data?.message ?? "Failed to update opportunity",
    };
  },
};

// Stubs (TODO: implementar em PR futuro).
const notImplemented = (label: string): ActionHandler => ({
  buildDeclaration(action) {
    return {
      name: fnNameForAction(action),
      description: `[${action.name}] ${label} (NAO IMPLEMENTADO no runtime ainda — sera ignorada).`,
      parameters: { type: "object", properties: {}, required: [] },
    };
  },
  async execute() {
    return { success: false, error: `${label} action not implemented yet` };
  },
});

const handlers: Record<string, ActionHandler> = {
  triggerWorkflow,
  updateContactField,
  stopBot,
  humanHandOver,
  transferBot,
  createOpportunity,
  updateOpportunity,
  appointmentBooking: notImplemented("Appointment Booking"),
  advancedFollowup: notImplemented("Advanced Followup"),
};

// =====================================================
// Public API
// =====================================================

/**
 * Carrega agent_actions ativas do agent. Usar antes de buildToolsFromActions.
 */
export async function loadActiveActions(supabaseClient: any, agentId: string): Promise<ActionRow[]> {
  const { data, error } = await supabaseClient
    .from("agent_actions")
    .select("id, agent_id, action_type, name, description, config, is_active, sort_order")
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading agent_actions:", error);
    return [];
  }
  return (data ?? []) as ActionRow[];
}

/**
 * Gera o array `tools` pro Gemini concatenando declarations base com as
 * dinamicas vindas das agent_actions ativas.
 */
export function buildToolsFromActions(actions: ActionRow[], baseDeclarations: ToolDeclaration[]) {
  const dynamic = actions
    .filter((a) => handlers[a.action_type])
    .map((a) => handlers[a.action_type].buildDeclaration(a));
  return [{ function_declarations: [...baseDeclarations, ...dynamic] }];
}

/**
 * Tenta executar uma functionCall vinda do Gemini como agent_action.
 * Retorna null se o name nao casar com nenhuma action conhecida (ai o
 * caller faz fallback pro TOOL_MAP estatico).
 */
export async function tryExecuteAgentAction(
  fnName: string,
  args: Record<string, any>,
  actions: ActionRow[],
  ctx: ActionContext,
): Promise<any | null> {
  const action = actions.find((a) => fnNameForAction(a) === fnName);
  if (!action) return null;
  const handler = handlers[action.action_type];
  if (!handler) return { error: `Action type ${action.action_type} not implemented` };
  try {
    return await handler.execute(action, args, ctx);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
