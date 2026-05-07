'use client';

import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SelectField, StringArrayInput, SwitchField } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

export type TransferBotConfig = {
  transferBotType: 'Default' | 'Custom';
  transferToBot: string;
  enabled: boolean;
  transferBotTriggerCondition: string;
  transferBotExamples: string[];
};

export const transferBotDefaults: TransferBotConfig = {
  transferBotType: 'Default',
  transferToBot: '',
  enabled: true,
  transferBotTriggerCondition: '',
  transferBotExamples: [],
};

export function TransferBotForm({
  value,
  onChange,
  locationId,
  currentAgentId,
}: {
  value: TransferBotConfig;
  onChange: (v: TransferBotConfig) => void;
  locationId: string;
  currentAgentId: string;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="transferBotType">
        <FieldLabel label="Tipo de Transferencia" required />
        <SelectField
          value={value.transferBotType}
          onChange={(v) => onChange({ ...value, transferBotType: v })}
          options={[
            { value: 'Default', label: 'Padrao' },
            { value: 'Custom', label: 'Customizado' },
          ]}
        />
      </FieldGroup>

      <FieldGroup errorField="transferToBot">
        <FieldLabel label="Agent de Destino" hint="Outro agent na mesma subconta que vai receber a conversa" required />
        <GhlSelect
          resource="agents-options"
          locationId={locationId}
          extraParams={{ exclude: currentAgentId }}
          value={value.transferToBot}
          onChange={(id) => onChange({ ...value, transferToBot: id })}
          placeholder="Selecione um agent..."
        />
      </FieldGroup>

      <FieldGroup errorField="transferBotTriggerCondition">
        <FieldLabel
          label="Condicao de Disparo"
          hint="Quando transferir (10-500 caracteres)"
          required
        />
        <Textarea
          value={value.transferBotTriggerCondition}
          onChange={(e) => onChange({ ...value, transferBotTriggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato pedir suporte tecnico avancado"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="transferBotExamples">
        <FieldLabel label="Exemplos" hint="Mensagens que indicam transferencia (min 2)" required />
        <StringArrayInput
          values={value.transferBotExamples}
          onChange={(v) => onChange({ ...value, transferBotExamples: v })}
          placeholder="ex: quero suporte tecnico"
          emptyMessage="Adicione ao menos 2 exemplos"
        />
      </FieldGroup>

      <SwitchField
        label="Ativo"
        checked={value.enabled}
        onChange={(v) => onChange({ ...value, enabled: v })}
      />
    </div>
  );
}
