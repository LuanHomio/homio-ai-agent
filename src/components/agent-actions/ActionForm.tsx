'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CONFIG_SCHEMAS } from '@/lib/agent-action-schemas';
import type { ActionType } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import type { AgentActionRow } from './ActionCard';
import { FormErrorProvider } from './error-context';
import { FieldGroup, FieldLabel, FormError, SwitchField } from './form-fields';
import { TriggerWorkflowForm, triggerWorkflowDefaults } from './forms/TriggerWorkflowForm';
import { UpdateContactFieldForm, updateContactFieldDefaults } from './forms/UpdateContactFieldForm';
import { AppointmentBookingForm, appointmentBookingDefaults } from './forms/AppointmentBookingForm';
import { StopBotForm, stopBotDefaults } from './forms/StopBotForm';
import { HumanHandOverForm, humanHandOverDefaults } from './forms/HumanHandOverForm';
import { AdvancedFollowupForm, advancedFollowupDefaults } from './forms/AdvancedFollowupForm';
import { TransferBotForm, transferBotDefaults } from './forms/TransferBotForm';

const CONFIG_DEFAULTS: Record<ActionType, unknown> = {
  triggerWorkflow: triggerWorkflowDefaults,
  updateContactField: updateContactFieldDefaults,
  appointmentBooking: appointmentBookingDefaults,
  stopBot: stopBotDefaults,
  humanHandOver: humanHandOverDefaults,
  advancedFollowup: advancedFollowupDefaults,
  transferBot: transferBotDefaults,
};

type SaveResult =
  | { ok: true; data: AgentActionRow }
  | { ok: false; status: number; error: { message?: string; issues?: { path: (string | number)[]; message: string }[] } };

export interface Props {
  agentId: string;
  locationId: string;
  actionType: ActionType;
  /** Quando null = criar nova; senao = editar essa action */
  editAction: AgentActionRow | null;
  onSaved: (saved: AgentActionRow) => void;
  onCancel: () => void;
}

export function ActionForm({ agentId, locationId, actionType, editAction, onSaved, onCancel }: Props) {
  const isEdit = editAction !== null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [issues, setIssues] = useState<{ path: (string | number)[]; message: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Sincroniza state com o "alvo" (edit:id ou create:type) DURANTE o render
  // pra evitar config drift quando actionType/editAction mudam.
  const targetKey = isEdit && editAction ? `edit:${editAction.id}` : `create:${actionType}`;
  const prevTargetKey = useRef<string | null>(null);

  if (prevTargetKey.current !== targetKey) {
    prevTargetKey.current = targetKey;
    setIssues(null);
    if (isEdit && editAction) {
      setName(editAction.name);
      setDescription(editAction.description ?? '');
      setIsActive(editAction.is_active);
      setConfig(CONFIG_DEFAULTS[actionType]);
      setLoadingExisting(true);
    } else {
      setName('');
      setDescription('');
      setIsActive(true);
      setConfig(CONFIG_DEFAULTS[actionType]);
      setLoadingExisting(false);
    }
  }

  // Fetch async do config persistido (so em edit). Sobrescreve o default hidratado acima.
  useEffect(() => {
    if (!isEdit || !editAction) return;
    let cancelled = false;
    fetch(`/api/agents/${agentId}/actions/${editAction.id}`)
      .then((r) => r.json())
      .then((row) => {
        if (cancelled) return;
        setConfig(row.config ?? CONFIG_DEFAULTS[actionType]);
      })
      .catch(() => {
        if (cancelled) return;
        setConfig(CONFIG_DEFAULTS[actionType]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, editAction?.id, agentId, actionType]);

  const handleSave = async () => {
    setIssues(null);

    const schema = CONFIG_SCHEMAS[actionType];
    const cfgParse = schema.safeParse(config);
    if (!cfgParse.success) {
      setIssues(cfgParse.error.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message })));
      return;
    }

    if (name.trim().length < 3 || name.trim().length > 50) {
      setIssues([{ path: ['name'], message: 'Nome deve ter entre 3 e 50 caracteres' }]);
      return;
    }

    setBusy(true);
    try {
      const result = await saveAction({
        agentId,
        editAction,
        actionType,
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
        config: cfgParse.data,
      });

      if (!result.ok) {
        if (result.error.issues) {
          setIssues(result.error.issues);
        } else {
          setIssues([{ path: [], message: result.error.message || `Erro ${result.status}` }]);
        }
        return;
      }

      onSaved(result.data);
    } catch (e) {
      setIssues([{ path: [], message: e instanceof Error ? e.message : 'Erro inesperado' }]);
    } finally {
      setBusy(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-homio-purple-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <FormErrorProvider issues={issues}>
          <FieldGroup errorField="name">
            <FieldLabel label="Nome" hint="3-50 caracteres" required />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: qualified-lead-followup"
              maxLength={50}
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel label="Descrição (opcional)" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição livre — ajuda você a lembrar o propósito da ação"
              rows={2}
            />
          </FieldGroup>

          <SwitchField label="Ação ativa" checked={isActive} onChange={setIsActive} />

          <div className="border-t border-border pt-5">
            {config !== null && (
              <ConfigForm
                actionType={actionType}
                value={config}
                onChange={setConfig}
                locationId={locationId}
                agentId={agentId}
              />
            )}
          </div>

          <FormError issues={issues} />
        </FormErrorProvider>
      </div>

      <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={busy || config === null}
          className="bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : isEdit ? (
            'Salvar'
          ) : (
            'Criar Ação'
          )}
        </Button>
      </div>
    </div>
  );
}

function ConfigForm({
  actionType,
  value,
  onChange,
  locationId,
  agentId,
}: {
  actionType: ActionType;
  value: any;
  onChange: (v: any) => void;
  locationId: string;
  agentId: string;
}) {
  switch (actionType) {
    case 'triggerWorkflow':
      return <TriggerWorkflowForm value={value} onChange={onChange} locationId={locationId} />;
    case 'updateContactField':
      return <UpdateContactFieldForm value={value} onChange={onChange} locationId={locationId} />;
    case 'appointmentBooking':
      return <AppointmentBookingForm value={value} onChange={onChange} locationId={locationId} />;
    case 'stopBot':
      return <StopBotForm value={value} onChange={onChange} />;
    case 'humanHandOver':
      return <HumanHandOverForm value={value} onChange={onChange} locationId={locationId} />;
    case 'advancedFollowup':
      return <AdvancedFollowupForm value={value} onChange={onChange} />;
    case 'transferBot':
      return (
        <TransferBotForm
          value={value}
          onChange={onChange}
          locationId={locationId}
          currentAgentId={agentId}
        />
      );
  }
}

async function saveAction({
  agentId,
  editAction,
  actionType,
  name,
  description,
  is_active,
  config,
}: {
  agentId: string;
  editAction: AgentActionRow | null;
  actionType: ActionType;
  name: string;
  description: string | null;
  is_active: boolean;
  config: unknown;
}): Promise<SaveResult> {
  if (editAction) {
    const res = await fetch(`/api/agents/${agentId}/actions/${editAction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, is_active, config }),
    });
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json };
  }

  const res = await fetch(`/api/agents/${agentId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: actionType, name, description, is_active, config }),
  });
  const json = await res.json();
  return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json };
}
