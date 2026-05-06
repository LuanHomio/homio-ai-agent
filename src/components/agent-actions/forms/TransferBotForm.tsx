'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SelectField, StringArrayInput, SwitchField } from '../form-fields';

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
}: {
  value: TransferBotConfig;
  onChange: (v: TransferBotConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup>
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

      <FieldGroup>
        <FieldLabel label="ID do Agent Destino" hint="ID do agent (GHL) que vai receber a conversa" required />
        <Input
          value={value.transferToBot}
          onChange={(e) => onChange({ ...value, transferToBot: e.target.value })}
          placeholder="ex: agent-id-123"
        />
      </FieldGroup>

      <FieldGroup>
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

      <FieldGroup>
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
