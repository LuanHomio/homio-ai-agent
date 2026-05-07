'use client';

import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, StringArrayInput } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

export type UpdateContactFieldConfig = {
  contactFieldId: string;
  description: string;
  contactUpdateExamples: string[];
};

export const updateContactFieldDefaults: UpdateContactFieldConfig = {
  contactFieldId: '',
  description: '',
  contactUpdateExamples: [],
};

export function UpdateContactFieldForm({
  value,
  onChange,
  locationId,
}: {
  value: UpdateContactFieldConfig;
  onChange: (v: UpdateContactFieldConfig) => void;
  locationId: string;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="contactFieldId">
        <FieldLabel label="Campo do Contato" hint="Custom field do contato no GHL" required />
        <GhlSelect
          resource="custom-fields"
          locationId={locationId}
          extraParams={{ model: 'contact' }}
          value={value.contactFieldId}
          onChange={(id) => onChange({ ...value, contactFieldId: id })}
          placeholder="Selecione um campo..."
        />
      </FieldGroup>

      <FieldGroup errorField="description">
        <FieldLabel
          label="Descricao do que coletar"
          hint="O que o bot deve perguntar/coletar (1-500 caracteres)"
          required
        />
        <Textarea
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Ex: Coletar o melhor email de contato"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup errorField="contactUpdateExamples">
        <FieldLabel
          label="Exemplos (opcional)"
          hint="Exemplos de respostas validas — obrigatorio pra dataType=TEXT no GHL"
        />
        <StringArrayInput
          values={value.contactUpdateExamples}
          onChange={(v) => onChange({ ...value, contactUpdateExamples: v })}
          placeholder="ex: usuario@empresa.com"
        />
      </FieldGroup>
    </div>
  );
}
