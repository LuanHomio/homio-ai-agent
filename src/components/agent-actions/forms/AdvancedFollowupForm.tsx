'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, FieldLabel, SelectField, SwitchField } from '../form-fields';
import { Plus, X } from 'lucide-react';

export type FollowupStep = {
  id: number;
  followupTime: number;
  followupTimeUnit: 'minutes' | 'hours' | 'days';
  aiEnabledMessage: boolean;
  triggerWorkflow: boolean;
};

export type AdvancedFollowupConfig = {
  enabled: boolean;
  scenarioId: 'contactStoppedReplying' | 'contactIsBusy' | 'contactRequested';
  followupSequence: FollowupStep[];
};

export const advancedFollowupDefaults: AdvancedFollowupConfig = {
  enabled: true,
  scenarioId: 'contactStoppedReplying',
  followupSequence: [
    { id: 1, followupTime: 1, followupTimeUnit: 'hours', aiEnabledMessage: true, triggerWorkflow: false },
  ],
};

export function AdvancedFollowupForm({
  value,
  onChange,
}: {
  value: AdvancedFollowupConfig;
  onChange: (v: AdvancedFollowupConfig) => void;
}) {
  const updateStep = (idx: number, patch: Partial<FollowupStep>) => {
    onChange({
      ...value,
      followupSequence: value.followupSequence.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  };

  const addStep = () => {
    if (value.followupSequence.length >= 5) return;
    const nextId = (value.followupSequence[value.followupSequence.length - 1]?.id || 0) + 1;
    onChange({
      ...value,
      followupSequence: [
        ...value.followupSequence,
        { id: nextId, followupTime: 1, followupTimeUnit: 'hours', aiEnabledMessage: true, triggerWorkflow: false },
      ],
    });
  };

  const removeStep = (idx: number) => {
    onChange({ ...value, followupSequence: value.followupSequence.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <FieldGroup errorField="scenarioId">
        <FieldLabel label="Cenario" required />
        <SelectField
          value={value.scenarioId}
          onChange={(v) => onChange({ ...value, scenarioId: v })}
          options={[
            { value: 'contactStoppedReplying', label: 'Contato parou de responder' },
            { value: 'contactIsBusy', label: 'Contato esta ocupado' },
            { value: 'contactRequested', label: 'Contato pediu follow-up' },
          ]}
        />
      </FieldGroup>

      <SwitchField
        label="Ativo"
        checked={value.enabled}
        onChange={(v) => onChange({ ...value, enabled: v })}
      />

      <FieldGroup errorField="followupSequence">
        <FieldLabel
          label="Sequencia de Follow-ups"
          hint="Maximo 5 etapas. Cada etapa dispara apos o tempo definido"
          required
        />
        <div className="space-y-3">
          {value.followupSequence.map((step, idx) => (
            <div key={idx} className="bg-secondary border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Etapa {idx + 1}</span>
                {value.followupSequence.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tempo (1-180)</label>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={step.followupTime}
                    onChange={(e) => updateStep(idx, { followupTime: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
                  <SelectField
                    value={step.followupTimeUnit}
                    onChange={(v) => updateStep(idx, { followupTimeUnit: v })}
                    options={[
                      { value: 'minutes', label: 'Minutos' },
                      { value: 'hours', label: 'Horas' },
                      { value: 'days', label: 'Dias' },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <SwitchField
                  label="AI gera a mensagem"
                  checked={step.aiEnabledMessage}
                  onChange={(v) => updateStep(idx, { aiEnabledMessage: v })}
                />
                <SwitchField
                  label="Disparar workflow"
                  checked={step.triggerWorkflow}
                  onChange={(v) => updateStep(idx, { triggerWorkflow: v })}
                />
              </div>
            </div>
          ))}

          {value.followupSequence.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Etapa
            </Button>
          )}
        </div>
      </FieldGroup>
    </div>
  );
}
