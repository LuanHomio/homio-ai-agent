'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_TYPE_META } from '@/lib/agent-action-display';
import { CONFIG_SCHEMAS } from '@/lib/agent-action-schemas';
import type { ActionType } from '@/lib/types';
import { Loader2, X } from 'lucide-react';
import type { AgentActionRow } from './ActionCard';
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
  isOpen: boolean;
  agentId: string;
  /** When provided, the form opens in edit mode for this action. */
  editAction: AgentActionRow | null;
  /** When creating, the user-selected type. Ignored in edit mode. */
  createType: ActionType | null;
  onClose: () => void;
  onSaved: (saved: AgentActionRow) => void;
}

export function ActionFormModal({ isOpen, agentId, editAction, createType, onClose, onSaved }: Props) {
  const isEdit = editAction !== null;
  const actionType: ActionType | null = isEdit ? (editAction!.action_type as ActionType) : createType;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [issues, setIssues] = useState<{ path: (string | number)[]; message: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Reset state when modal opens / target changes
  useEffect(() => {
    if (!isOpen || !actionType) return;
    setIssues(null);

    if (isEdit) {
      // Hidrata config do servidor (lista nao traz config)
      setLoadingExisting(true);
      setName(editAction!.name);
      setDescription(editAction!.description ?? '');
      setIsActive(editAction!.is_active);
      fetch(`/api/agents/${agentId}/actions/${editAction!.id}`)
        .then((r) => r.json())
        .then((row) => {
          setConfig(row.config ?? CONFIG_DEFAULTS[actionType]);
        })
        .catch(() => setConfig(CONFIG_DEFAULTS[actionType]))
        .finally(() => setLoadingExisting(false));
    } else {
      setName('');
      setDescription('');
      setIsActive(true);
      setConfig(CONFIG_DEFAULTS[actionType]);
    }
  }, [isOpen, actionType, isEdit, editAction, agentId]);

  const meta = useMemo(() => (actionType ? ACTION_TYPE_META[actionType] : null), [actionType]);

  if (!isOpen || !actionType || !meta) return null;

  const handleSave = async () => {
    setIssues(null);

    // Client-side validation against the same schema the server uses
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
      onClose();
    } catch (e) {
      setIssues([{ path: [], message: e instanceof Error ? e.message : 'Erro inesperado' }]);
    } finally {
      setBusy(false);
    }
  };

  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-homio-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-homio-purple-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {isEdit ? 'Editar Ação' : 'Nova Ação'}: {meta.label}
              </h2>
              <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loadingExisting ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-homio-purple-300 animate-spin" />
            </div>
          ) : (
            <>
              <FieldGroup>
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
                  <ConfigForm actionType={actionType} value={config} onChange={setConfig} />
                )}
              </div>

              <FormError issues={issues} />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={busy || loadingExisting || config === null}
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
    </div>
  );
}

function ConfigForm({
  actionType,
  value,
  onChange,
}: {
  actionType: ActionType;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (actionType) {
    case 'triggerWorkflow':
      return <TriggerWorkflowForm value={value} onChange={onChange} />;
    case 'updateContactField':
      return <UpdateContactFieldForm value={value} onChange={onChange} />;
    case 'appointmentBooking':
      return <AppointmentBookingForm value={value} onChange={onChange} />;
    case 'stopBot':
      return <StopBotForm value={value} onChange={onChange} />;
    case 'humanHandOver':
      return <HumanHandOverForm value={value} onChange={onChange} />;
    case 'advancedFollowup':
      return <AdvancedFollowupForm value={value} onChange={onChange} />;
    case 'transferBot':
      return <TransferBotForm value={value} onChange={onChange} />;
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
