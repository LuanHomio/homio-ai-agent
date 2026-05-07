'use client';

import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, StringArrayInput, SwitchField } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

export type CreateOpportunityConfig = {
  pipelineId: string;
  pipelineStageId: string;
  triggerCondition: string;
  examples: string[];
  enabled: boolean;
  source?: string;
  assignedToUserId?: string;
  collectMonetaryValue: boolean;
  agentEditableCustomFieldIds: string[];
};

export const createOpportunityDefaults: CreateOpportunityConfig = {
  pipelineId: '',
  pipelineStageId: '',
  triggerCondition: '',
  examples: [],
  enabled: true,
  source: '',
  assignedToUserId: '',
  collectMonetaryValue: false,
  agentEditableCustomFieldIds: [],
};

export function CreateOpportunityForm({
  value,
  onChange,
  locationId,
}: {
  value: CreateOpportunityConfig;
  onChange: (v: CreateOpportunityConfig) => void;
  locationId: string;
}) {
  // Reset stage quando pipeline muda — stage do pipeline antigo nao
  // existe no novo, manter dava write inconsistente no GHL.
  useEffect(() => {
    if (!value.pipelineId && value.pipelineStageId) {
      onChange({ ...value, pipelineStageId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.pipelineId]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground p-3 bg-secondary/40 rounded-lg border border-border">
        💡 O contato da conversa é usado automaticamente. O nome da oportunidade fica igual ao
        nome do contato.
      </p>

      <FieldGroup errorField="pipelineId">
        <FieldLabel label="Pipeline" hint="Em qual pipeline criar a opportunity" required />
        <GhlSelect
          resource="pipelines"
          locationId={locationId}
          value={value.pipelineId}
          onChange={(id) => onChange({ ...value, pipelineId: id, pipelineStageId: '' })}
          placeholder="Selecione um pipeline..."
        />
      </FieldGroup>

      <FieldGroup errorField="pipelineStageId">
        <FieldLabel label="Stage Inicial" hint="Em qual estágio a opportunity entra" required />
        <GhlSelect
          resource="pipeline-stages"
          locationId={locationId}
          extraParams={value.pipelineId ? { pipelineId: value.pipelineId } : { pipelineId: '' }}
          value={value.pipelineStageId}
          onChange={(id) => onChange({ ...value, pipelineStageId: id })}
          placeholder={value.pipelineId ? 'Selecione um stage...' : 'Selecione o pipeline primeiro'}
          disabled={!value.pipelineId}
        />
      </FieldGroup>

      <FieldGroup errorField="triggerCondition">
        <FieldLabel
          label="Condição de Disparo"
          hint="Quando criar a opportunity (10-500 caracteres)"
          required
        />
        <Textarea
          value={value.triggerCondition}
          onChange={(e) => onChange({ ...value, triggerCondition: e.target.value })}
          placeholder="Ex: Quando o contato demonstrar intenção clara de compra"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="examples">
        <FieldLabel label="Exemplos" hint="Mensagens que indicam intenção de criar opp (min 1)" required />
        <StringArrayInput
          values={value.examples}
          onChange={(v) => onChange({ ...value, examples: v })}
          placeholder="ex: quero comprar"
          emptyMessage="Adicione ao menos 1 exemplo"
        />
      </FieldGroup>

      <div className="border-t border-border pt-4 space-y-4">
        <p className="text-sm font-medium text-foreground/90">Campos opcionais (fixos)</p>

        <FieldGroup errorField="source">
          <FieldLabel label="Fonte (source)" hint="Texto fixo gravado no campo source da opp" />
          <Input
            value={value.source ?? ''}
            onChange={(e) => onChange({ ...value, source: e.target.value })}
            placeholder="Ex: WhatsApp IA"
          />
        </FieldGroup>

        <FieldGroup errorField="assignedToUserId">
          <FieldLabel label="Responsável" hint="User do GHL a quem atribuir a opp (opcional)" />
          <GhlSelect
            resource="users"
            locationId={locationId}
            value={value.assignedToUserId ?? ''}
            onChange={(id) => onChange({ ...value, assignedToUserId: id })}
            placeholder="Sem responsável fixo"
          />
        </FieldGroup>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-foreground/90">Campos preenchidos pelo agent</p>

        <SwitchField
          label="Permitir agent definir o valor (monetaryValue)"
          hint="Quando ativo, o agent pode estimar/coletar e gravar o valor monetário"
          checked={value.collectMonetaryValue}
          onChange={(v) => onChange({ ...value, collectMonetaryValue: v })}
        />

        <FieldGroup errorField="agentEditableCustomFieldIds">
          <FieldLabel
            label="Custom fields da opp que o agent pode preencher"
            hint="O agent decide os valores baseado na conversa"
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
