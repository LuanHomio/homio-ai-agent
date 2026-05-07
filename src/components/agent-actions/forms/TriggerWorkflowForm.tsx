'use client';

import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, StringArrayInput } from '../form-fields';

export type TriggerWorkflowConfig = {
  workflowIds: string[];
  triggerCondition: string;
};

export const triggerWorkflowDefaults: TriggerWorkflowConfig = {
  workflowIds: [],
  triggerCondition: '',
};

export function TriggerWorkflowForm({
  value,
  onChange,
}: {
  value: TriggerWorkflowConfig;
  onChange: (v: TriggerWorkflowConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="workflowIds">
        <FieldLabel
          label="IDs dos Workflows"
          hint="UUIDs dos workflows do GHL que serao disparados (1 ou mais)"
          required
        />
        <StringArrayInput
          values={value.workflowIds}
          onChange={(v) => onChange({ ...value, workflowIds: v })}
          placeholder="ex: 6b9f...e3a4"
          emptyMessage="Adicione ao menos 1 workflow ID"
        />
      </FieldGroup>

      <FieldGroup errorField="triggerCondition">
        <FieldLabel
          label="Condicao de Disparo"
          hint="Texto natural — o LLM decide quando disparar baseado nesta descricao"
          required
        />
        <Textarea
          value={value.triggerCondition}
          onChange={(e) => onChange({ ...value, triggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato confirmar interesse no produto"
          rows={3}
        />
      </FieldGroup>
    </div>
  );
}
