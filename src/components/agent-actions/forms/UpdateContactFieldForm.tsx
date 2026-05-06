'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, StringArrayInput } from '../form-fields';

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
}: {
  value: UpdateContactFieldConfig;
  onChange: (v: UpdateContactFieldConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup>
        <FieldLabel
          label="ID do Custom Field"
          hint="ID do campo customizado do contato no GHL"
          required
        />
        <Input
          value={value.contactFieldId}
          onChange={(e) => onChange({ ...value, contactFieldId: e.target.value })}
          placeholder="ex: dXyZ12abc"
        />
      </FieldGroup>

      <FieldGroup>
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

      <FieldGroup>
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
