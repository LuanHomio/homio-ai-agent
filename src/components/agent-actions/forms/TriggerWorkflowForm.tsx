'use client';

import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

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
  locationId,
}: {
  value: TriggerWorkflowConfig;
  onChange: (v: TriggerWorkflowConfig) => void;
  locationId: string;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="workflowIds">
        <FieldLabel
          label="Workflows"
          hint="Workflows do GHL que serao disparados (1 ou mais)"
          required
        />
        <GhlSelect
          multi
          resource="workflows"
          locationId={locationId}
          value={value.workflowIds}
          onChange={(ids) => onChange({ ...value, workflowIds: ids })}
          placeholder="Selecione um ou mais workflows..."
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
