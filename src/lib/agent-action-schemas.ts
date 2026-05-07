import { z } from 'zod';
import { ACTION_TYPES, type ActionType } from './types';

// Schemas do `config` por action_type — espelham 1:1 os campos da API
// GHL (ver wiki/processos/processo_ghl_actions.md). Nomes mantidos
// camelCase com prefixo por tipo (stopBotExamples etc) pra paridade com
// o port futuro bidirecional.

const triggerWorkflowConfig = z.object({
  workflowIds: z
    .array(z.string().uuid({ message: 'ID de workflow precisa ser um UUID valido' }))
    .min(1, { message: 'Adicione ao menos 1 workflow' }),
  triggerCondition: z.string().min(1, { message: 'Condicao de disparo e obrigatoria' }),
});

const updateContactFieldConfig = z.object({
  contactFieldId: z.string().min(1, { message: 'Selecione o campo do contato' }),
  description: z
    .string()
    .min(1, { message: 'Descricao e obrigatoria' })
    .max(500, { message: 'Descricao tem no maximo 500 caracteres' }),
  // Obrigatorio pra dataType=TEXT no GHL. Outros dataTypes (DATE,
  // MULTIPLE_OPTIONS, etc) ainda nao foram sondados — manter optional
  // ate confirmar shape final.
  contactUpdateExamples: z.array(z.string()).optional(),
});

const appointmentBookingConfig = z.object({
  calendarId: z.string().min(1, { message: 'Selecione um calendar' }),
  onlySendLink: z.boolean().default(false),
  triggerWorkflow: z.boolean().default(false),
  sleepAfterBooking: z.boolean().default(false),
  transferBot: z.boolean().default(false),
  rescheduleEnabled: z.boolean().default(true),
  cancelEnabled: z.boolean().default(true),
});

const sleepFields = {
  reactivateEnabled: z.boolean().default(true),
  sleepTime: z
    .number({ message: 'Tempo de pausa precisa ser um numero' })
    .int({ message: 'Tempo de pausa precisa ser inteiro' })
    .positive({ message: 'Tempo de pausa precisa ser maior que zero' })
    .optional(),
  sleepTimeUnit: z.enum(['minutes', 'hours', 'days']).optional(),
};

const stopBotConfig = z
  .object({
    stopBotDetectionType: z.enum(['Goodbye', 'Custom']),
    stopBotTriggerCondition: z
      .string()
      .min(10, { message: 'Condicao de disparo precisa ter no minimo 10 caracteres' })
      .max(500, { message: 'Condicao de disparo tem no maximo 500 caracteres' }),
    stopBotExamples: z
      .array(z.string())
      .min(2, { message: 'Adicione no minimo 2 exemplos (digite e clique no botao + ou pressione Enter)' }),
    finalMessage: z
      .string()
      .min(3, { message: 'Mensagem final precisa ter no minimo 3 caracteres' })
      .max(150, { message: 'Mensagem final tem no maximo 150 caracteres' }),
    enabled: z.boolean().default(true),
    ...sleepFields,
  })
  .refine(
    (d) => !d.reactivateEnabled || (d.sleepTime !== undefined && d.sleepTimeUnit !== undefined),
    { message: 'Quando reativar automaticamente esta ligado, tempo e unidade de pausa sao obrigatorios', path: ['sleepTime'] },
  );

const transferBotConfig = z.object({
  transferBotType: z.enum(['Default', 'Custom']),
  transferToBot: z.string().min(1, { message: 'ID do agent de destino e obrigatorio' }),
  enabled: z.boolean().default(true),
  transferBotTriggerCondition: z
    .string()
    .min(10, { message: 'Condicao de disparo precisa ter no minimo 10 caracteres' })
    .max(500, { message: 'Condicao de disparo tem no maximo 500 caracteres' }),
  transferBotExamples: z
    .array(z.string())
    .min(2, { message: 'Adicione no minimo 2 exemplos (digite e clique no botao + ou pressione Enter)' }),
});

const advancedFollowupConfig = z.object({
  enabled: z.boolean().default(true),
  scenarioId: z.enum(['contactStoppedReplying', 'contactIsBusy', 'contactRequested']),
  followupSequence: z
    .array(
      z.object({
        id: z.number().int().min(1).max(5),
        followupTime: z
          .number()
          .int()
          .min(1, { message: 'Tempo precisa ser >= 1' })
          .max(180, { message: 'Tempo precisa ser <= 180' }),
        followupTimeUnit: z.enum(['minutes', 'hours', 'days']),
        aiEnabledMessage: z.boolean().default(true),
        triggerWorkflow: z.boolean().default(false),
      }),
    )
    .min(1, { message: 'Adicione ao menos 1 follow-up na sequencia' })
    .max(5, { message: 'No maximo 5 follow-ups na sequencia' }),
});

// `examples` aqui e generico (sem prefixo) — anomalia do GHL, mantido literal.
const humanHandOverConfig = z
  .object({
    enabled: z.boolean().default(true),
    triggerCondition: z
      .string()
      .min(10, { message: 'Condicao de disparo precisa ter no minimo 10 caracteres' })
      .max(500, { message: 'Condicao de disparo tem no maximo 500 caracteres' }),
    handoverType: z.enum(['contactRequest', 'lackOfInformation', 'failedToResolveIssue', 'custom']),
    examples: z
      .array(z.string())
      .min(1, { message: 'Adicione ao menos 1 exemplo (digite e clique no botao + ou pressione Enter)' }),
    finalMessage: z.string().min(1, { message: 'Mensagem final e obrigatoria' }),
    assignToUserId: z.string().min(1, { message: 'Selecione o usuario designado' }),
    skipAssignToUser: z.boolean().default(false),
    createTask: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    ...sleepFields,
  })
  .refine(
    (d) => !d.reactivateEnabled || (d.sleepTime !== undefined && d.sleepTimeUnit !== undefined),
    { message: 'Quando reativar automaticamente esta ligado, tempo e unidade de pausa sao obrigatorios', path: ['sleepTime'] },
  );

// Extensoes Homio (nao existem no GHL Conversation AI nativo).
// Lookup do contact = contato da conversa atual.
// Lookup da opp em update = ultima opp do contato (qualquer pipeline/status).

const createOpportunityConfig = z.object({
  pipelineId: z.string().min(1, { message: 'Selecione um pipeline' }),
  pipelineStageId: z.string().min(1, { message: 'Selecione um stage inicial' }),
  triggerCondition: z
    .string()
    .min(10, { message: 'Condicao de disparo precisa ter no minimo 10 caracteres' })
    .max(500, { message: 'Condicao de disparo tem no maximo 500 caracteres' }),
  examples: z
    .array(z.string())
    .min(1, { message: 'Adicione ao menos 1 exemplo (digite e clique no botao + ou pressione Enter)' }),
  enabled: z.boolean().default(true),
  // Fixos na config (opcional)
  source: z.string().max(200).optional(),
  assignedToUserId: z.string().optional(),
  // O agent pode preencher esses campos via tool calling
  collectMonetaryValue: z.boolean().default(false),
  agentEditableCustomFieldIds: z.array(z.string()).default([]),
});

const updateOpportunityConfig = z.object({
  triggerCondition: z
    .string()
    .min(10, { message: 'Condicao de disparo precisa ter no minimo 10 caracteres' })
    .max(500, { message: 'Condicao de disparo tem no maximo 500 caracteres' }),
  examples: z
    .array(z.string())
    .min(1, { message: 'Adicione ao menos 1 exemplo (digite e clique no botao + ou pressione Enter)' }),
  enabled: z.boolean().default(true),
  // Permissoes do agent — quais campos ele pode atualizar
  canMoveStage: z.boolean().default(false),
  canChangeStatus: z.boolean().default(false),
  canUpdateMonetaryValue: z.boolean().default(false),
  canReassign: z.boolean().default(false),
  agentEditableCustomFieldIds: z.array(z.string()).default([]),
});

export const CONFIG_SCHEMAS: Record<ActionType, z.ZodTypeAny> = {
  triggerWorkflow: triggerWorkflowConfig,
  updateContactField: updateContactFieldConfig,
  appointmentBooking: appointmentBookingConfig,
  stopBot: stopBotConfig,
  humanHandOver: humanHandOverConfig,
  advancedFollowup: advancedFollowupConfig,
  transferBot: transferBotConfig,
  createOpportunity: createOpportunityConfig,
  updateOpportunity: updateOpportunityConfig,
};

const baseFields = {
  name: z.string().min(3).max(50),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0),
};

const createActionBaseSchema = z.object({
  action_type: z.enum(ACTION_TYPES),
  config: z.unknown(),
  ...baseFields,
});

const updateActionBaseSchema = z.object({
  // action_type imutavel apos criacao — config validado contra o tipo atual
  name: baseFields.name.optional(),
  description: baseFields.description,
  config: z.unknown().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type CreateAgentActionInput = z.infer<typeof createActionBaseSchema> & { config: Record<string, unknown> };
export type UpdateAgentActionInput = z.infer<typeof updateActionBaseSchema>;

export type ValidationError = { message: string; issues: z.ZodIssue[] };
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ValidationError };

function formatError(err: z.ZodError): ValidationError {
  return { message: 'Validation failed', issues: err.issues };
}

export function validateCreateAction(input: unknown): ValidationResult<CreateAgentActionInput> {
  const baseParsed = createActionBaseSchema.safeParse(input);
  if (!baseParsed.success) return { ok: false, error: formatError(baseParsed.error) };

  const configSchema = CONFIG_SCHEMAS[baseParsed.data.action_type];
  const configParsed = configSchema.safeParse(baseParsed.data.config);
  if (!configParsed.success) return { ok: false, error: formatError(configParsed.error) };

  return { ok: true, value: { ...baseParsed.data, config: configParsed.data as Record<string, unknown> } };
}

export function validateUpdateAction(
  input: unknown,
  currentActionType: ActionType,
): ValidationResult<UpdateAgentActionInput> {
  const baseParsed = updateActionBaseSchema.safeParse(input);
  if (!baseParsed.success) return { ok: false, error: formatError(baseParsed.error) };

  if (baseParsed.data.config !== undefined) {
    const configSchema = CONFIG_SCHEMAS[currentActionType];
    const configParsed = configSchema.safeParse(baseParsed.data.config);
    if (!configParsed.success) return { ok: false, error: formatError(configParsed.error) };
    return { ok: true, value: { ...baseParsed.data, config: configParsed.data as Record<string, unknown> } };
  }

  return { ok: true, value: baseParsed.data };
}
