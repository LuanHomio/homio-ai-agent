'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SelectField, StringArrayInput, SwitchField } from '../form-fields';
import { GhlSelect } from '../GhlSelect';
import { GhlTagInput } from '../GhlTagInput';

export type HumanHandOverConfig = {
  enabled: boolean;
  triggerCondition: string;
  handoverType: 'contactRequest' | 'lackOfInformation' | 'failedToResolveIssue' | 'custom';
  examples: string[];
  finalMessage: string;
  assignToUserId: string;
  skipAssignToUser: boolean;
  createTask: boolean;
  tags: string[];
  reactivateEnabled: boolean;
  sleepTime: number;
  sleepTimeUnit: 'minutes' | 'hours' | 'days';
};

export const humanHandOverDefaults: HumanHandOverConfig = {
  enabled: true,
  triggerCondition: '',
  handoverType: 'contactRequest',
  examples: [],
  finalMessage: '',
  assignToUserId: '',
  skipAssignToUser: false,
  createTask: false,
  tags: ['human handover'],
  reactivateEnabled: true,
  sleepTime: 8,
  sleepTimeUnit: 'hours',
};

export function HumanHandOverForm({
  value,
  onChange,
  locationId,
}: {
  value: HumanHandOverConfig;
  onChange: (v: HumanHandOverConfig) => void;
  locationId: string;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="handoverType">
        <FieldLabel label="Tipo de Handover" required />
        <SelectField
          value={value.handoverType}
          onChange={(v) => onChange({ ...value, handoverType: v })}
          options={[
            { value: 'contactRequest', label: 'Contato pediu humano' },
            { value: 'lackOfInformation', label: 'Falta de informacao' },
            { value: 'failedToResolveIssue', label: 'Falhou em resolver' },
            { value: 'custom', label: 'Customizado' },
          ]}
        />
      </FieldGroup>

      <FieldGroup errorField="triggerCondition">
        <FieldLabel
          label="Condicao de Disparo"
          hint="Quando transferir para humano (10-500 caracteres)"
          required
        />
        <Textarea
          value={value.triggerCondition}
          onChange={(e) => onChange({ ...value, triggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato pedir explicitamente para falar com um humano"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="examples">
        <FieldLabel label="Exemplos" hint="Mensagens que indicam pedido de humano (min 1)" required />
        <StringArrayInput
          values={value.examples}
          onChange={(v) => onChange({ ...value, examples: v })}
          placeholder="ex: quero falar com um humano"
          emptyMessage="Adicione ao menos 1 exemplo"
        />
      </FieldGroup>

      <FieldGroup errorField="finalMessage">
        <FieldLabel
          label="Mensagem Final"
          hint="Mensagem ao contato no momento do handover"
          required
        />
        <Input
          value={value.finalMessage}
          onChange={(e) => onChange({ ...value, finalMessage: e.target.value })}
          placeholder="Ex: Entendi! Vou te transferir para um atendente."
        />
      </FieldGroup>

      <FieldGroup errorField="assignToUserId">
        <FieldLabel
          label="Usuario Designado"
          hint="Usuario GHL a quem atribuir a conversa/task"
          required
        />
        <GhlSelect
          resource="users"
          locationId={locationId}
          value={value.assignToUserId}
          onChange={(id) => onChange({ ...value, assignToUserId: id })}
          placeholder="Selecione um usuario..."
        />
      </FieldGroup>

      <FieldGroup errorField="tags">
        <FieldLabel label="Tags a adicionar no contato" hint="Pesquise tags existentes ou crie novas" />
        <GhlTagInput
          locationId={locationId}
          value={value.tags}
          onChange={(v) => onChange({ ...value, tags: v })}
          placeholder="ex: human handover"
        />
      </FieldGroup>

      <div className="space-y-3 pt-2">
        <SwitchField
          label="Ativo"
          checked={value.enabled}
          onChange={(v) => onChange({ ...value, enabled: v })}
        />
        <SwitchField
          label="Pular atribuicao ao usuario"
          hint="Se ativo, mantem assignToUserId apenas como referencia (sem notificar)"
          checked={value.skipAssignToUser}
          onChange={(v) => onChange({ ...value, skipAssignToUser: v })}
        />
        <SwitchField
          label="Criar task no GHL ao disparar"
          checked={value.createTask}
          onChange={(v) => onChange({ ...value, createTask: v })}
        />
        <SwitchField
          label="Reativar automaticamente apos pausa"
          checked={value.reactivateEnabled}
          onChange={(v) => onChange({ ...value, reactivateEnabled: v })}
        />
      </div>

      {value.reactivateEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup errorField="sleepTime">
            <FieldLabel label="Tempo de Pausa" required />
            <Input
              type="number"
              min={1}
              value={value.sleepTime}
              onChange={(e) => onChange({ ...value, sleepTime: Number(e.target.value) || 0 })}
            />
          </FieldGroup>
          <FieldGroup errorField="sleepTimeUnit">
            <FieldLabel label="Unidade" required />
            <SelectField
              value={value.sleepTimeUnit}
              onChange={(v) => onChange({ ...value, sleepTimeUnit: v })}
              options={[
                { value: 'minutes', label: 'Minutos' },
                { value: 'hours', label: 'Horas' },
                { value: 'days', label: 'Dias' },
              ]}
            />
          </FieldGroup>
        </div>
      )}
    </div>
  );
}
