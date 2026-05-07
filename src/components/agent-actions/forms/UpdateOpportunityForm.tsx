'use client';

import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, StringArrayInput, SwitchField } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

export type UpdateOpportunityConfig = {
  triggerCondition: string;
  examples: string[];
  enabled: boolean;
  canMoveStage: boolean;
  canChangeStatus: boolean;
  canUpdateMonetaryValue: boolean;
  canReassign: boolean;
  agentEditableCustomFieldIds: string[];
};

export const updateOpportunityDefaults: UpdateOpportunityConfig = {
  triggerCondition: '',
  examples: [],
  enabled: true,
  canMoveStage: false,
  canChangeStatus: false,
  canUpdateMonetaryValue: false,
  canReassign: false,
  agentEditableCustomFieldIds: [],
};

export function UpdateOpportunityForm({
  value,
  onChange,
  locationId,
}: {
  value: UpdateOpportunityConfig;
  onChange: (v: UpdateOpportunityConfig) => void;
  locationId: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground p-3 bg-secondary/40 rounded-lg border border-border">
        💡 A opp atualizada é a <strong>mais recente do contato</strong> (em qualquer pipeline,
        qualquer status). Se não houver opp do contato, a action falha silenciosamente.
      </p>

      <FieldGroup errorField="triggerCondition">
        <FieldLabel
          label="Condição de Disparo"
          hint="Quando atualizar a opportunity (10-500 caracteres)"
          required
        />
        <Textarea
          value={value.triggerCondition}
          onChange={(e) => onChange({ ...value, triggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato confirmar fechamento da venda"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="examples">
        <FieldLabel label="Exemplos" hint="Mensagens que indicam intenção de update (min 1)" required />
        <StringArrayInput
          values={value.examples}
          onChange={(v) => onChange({ ...value, examples: v })}
          placeholder="ex: fechado!"
          emptyMessage="Adicione ao menos 1 exemplo"
        />
      </FieldGroup>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-foreground/90">Permissões do agent</p>
        <p className="text-xs text-muted-foreground">
          Marque o que o agent pode atualizar. Cada toggle ativo libera o campo correspondente
          como argumento da função no tool calling.
        </p>

        <SwitchField
          label="Pode mover de stage"
          hint="Agent pode mover a opp pra outro stage do mesmo pipeline"
          checked={value.canMoveStage}
          onChange={(v) => onChange({ ...value, canMoveStage: v })}
        />

        <SwitchField
          label="Pode mudar status"
          hint="Open / Won / Lost / Abandoned"
          checked={value.canChangeStatus}
          onChange={(v) => onChange({ ...value, canChangeStatus: v })}
        />

        <SwitchField
          label="Pode atualizar valor (monetaryValue)"
          checked={value.canUpdateMonetaryValue}
          onChange={(v) => onChange({ ...value, canUpdateMonetaryValue: v })}
        />

        <SwitchField
          label="Pode reatribuir responsável"
          hint="Agent pode trocar o user atribuído à opp"
          checked={value.canReassign}
          onChange={(v) => onChange({ ...value, canReassign: v })}
        />

        <FieldGroup errorField="agentEditableCustomFieldIds">
          <FieldLabel
            label="Custom fields da opp que o agent pode atualizar"
            hint="O agent decide os valores novos baseado na conversa"
          />
          <GhlSelect
            multi
            resource="custom-fields"
            locationId={locationId}
            extraParams={{ model: 'opportunity' }}
            value={value.agentEditableCustomFieldIds}
            onChange={(ids) => onChange({ ...value, agentEditableCustomFieldIds: ids })}
            placeholder="Nenhum (selecione 1+ pra liberar pro agent)..."
          />
        </FieldGroup>
      </div>

      <SwitchField
        label="Ativo"
        checked={value.enabled}
        onChange={(v) => onChange({ ...value, enabled: v })}
      />
    </div>
  );
}
