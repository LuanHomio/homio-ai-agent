'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

export function FieldLabel({
  label,
  hint,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-2">
      <label className="block text-sm font-medium text-foreground/80">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 rounded border-border bg-secondary text-homio-purple-500 focus:ring-homio-purple-500"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground/90">{label}</span>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full p-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:border-homio-purple-500/40 focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function StringArrayInput({
  values,
  onChange,
  placeholder,
  emptyMessage,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };

  const removeAt = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!draft.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMessage || 'Nenhum item adicionado'}</p>
      ) : (
        <ul className="space-y-1">
          {values.map((v, idx) => (
            <li
              key={`${idx}-${v}`}
              className="flex items-center justify-between bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground/80"
            >
              <span className="truncate flex-1 mr-2">{v}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-muted-foreground hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormError({ issues }: { issues: { path: (string | number)[]; message: string }[] | null }) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
      <p className="text-red-400 font-medium mb-1">Validação falhou:</p>
      <ul className="text-red-300 text-xs space-y-0.5 list-disc list-inside">
        {issues.map((iss, idx) => (
          <li key={idx}>
            <span className="font-mono">{iss.path.join('.') || '(root)'}</span>: {iss.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
