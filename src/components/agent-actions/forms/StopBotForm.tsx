'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SelectField, StringArrayInput, SwitchField } from '../form-fields';

export type StopBotConfig = {
  stopBotDetectionType: 'Goodbye' | 'Custom';
  stopBotTriggerCondition: string;
  stopBotExamples: string[];
  finalMessage: string;
  enabled: boolean;
  reactivateEnabled: boolean;
  sleepTime: number;
  sleepTimeUnit: 'minutes' | 'hours' | 'days';
};

export const stopBotDefaults: StopBotConfig = {
  stopBotDetectionType: 'Goodbye',
  stopBotTriggerCondition: '',
  stopBotExamples: [],
  finalMessage: '',
  enabled: true,
  reactivateEnabled: true,
  sleepTime: 30,
  sleepTimeUnit: 'minutes',
};

export function StopBotForm({
  value,
  onChange,
}: {
  value: StopBotConfig;
  onChange: (v: StopBotConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="stopBotDetectionType">
        <FieldLabel label="Tipo de Deteccao" required />
        <SelectField
          value={value.stopBotDetectionType}
          onChange={(v) => onChange({ ...value, stopBotDetectionType: v })}
          options={[
            { value: 'Goodbye', label: 'Despedida (Goodbye)' },
            { value: 'Custom', label: 'Customizado' },
          ]}
        />
      </FieldGroup>

      <FieldGroup errorField="stopBotTriggerCondition">
        <FieldLabel
          label="Condicao de Disparo"
          hint="Quando o bot deve parar (10-500 caracteres)"
          required
        />
        <Textarea
          value={value.stopBotTriggerCondition}
          onChange={(e) => onChange({ ...value, stopBotTriggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato se despedir ou agradecer pelo atendimento"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="stopBotExamples">
        <FieldLabel label="Exemplos" hint="Mensagens que indicam que o bot deve parar (min 2)" required />
        <StringArrayInput
          values={value.stopBotExamples}
          onChange={(v) => onChange({ ...value, stopBotExamples: v })}
          placeholder="ex: tchau"
          emptyMessage="Adicione ao menos 2 exemplos"
        />
      </FieldGroup>

      <FieldGroup errorField="finalMessage">
        <FieldLabel label="Mensagem Final" hint="Mensagem de despedida (3-150 caracteres)" required />
        <Input
          value={value.finalMessage}
          onChange={(e) => onChange({ ...value, finalMessage: e.target.value })}
          placeholder="Ex: Tchau! Foi um prazer conversar com voce."
        />
      </FieldGroup>

      <div className="space-y-3 pt-2">
        <SwitchField
          label="Ativo"
          checked={value.enabled}
          onChange={(v) => onChange({ ...value, enabled: v })}
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
