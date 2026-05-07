'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { invalidateGhlOptions, useGhlOptions, type GhlOption } from './use-ghl-options';
import { Loader2, Plus, X } from 'lucide-react';

export interface Props {
  locationId: string | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Tag input pesquisavel: chips das tags ja selecionadas + input com sugestoes
 * vindas da GHL. Quando o usuario digita um nome que nao casa com nenhuma
 * existente, aparece "Criar tag X" no fim da lista — POST cria a tag no GHL
 * e adiciona como selecionada.
 */
export function GhlTagInput({ locationId, value, onChange, placeholder }: Props) {
  const state = useGhlOptions('tags', locationId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items: GhlOption[] = state.status === 'ready' ? state.items : [];

  const lower = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!lower) return items;
    return items.filter((i) => i.label.toLowerCase().includes(lower));
  }, [items, lower]);

  const exactMatch = items.some((i) => i.label.toLowerCase() === lower);
  const showCreateOption = lower.length > 0 && !exactMatch;

  const isSelected = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase());

  const addTag = (name: string) => {
    if (!name.trim()) return;
    if (isSelected(name)) return;
    onChange([...value, name.trim()]);
    setQuery('');
  };

  const removeTag = (name: string) => {
    onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));
  };

  const createTag = async () => {
    if (!locationId || !lower || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/ghl/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, name: query.trim() }),
      });
      if (!res.ok) throw new Error('Falha ao criar tag');
      const tag = await res.json();
      invalidateGhlOptions('tags', locationId);
      addTag(tag.name ?? query.trim());
      state.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-homio-purple-500/15 text-homio-purple-100 text-xs rounded-md"
            >
              <span className="truncate max-w-[200px]">{name}</span>
              <button
                type="button"
                onClick={() => removeTag(name)}
                className="text-homio-purple-200 hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showCreateOption) {
                createTag();
              } else if (filtered.length > 0) {
                addTag(filtered[0].label);
              }
            }
          }}
          placeholder={placeholder ?? 'Digite pra buscar ou criar nova...'}
          disabled={!locationId}
        />

        {open && locationId && (
          <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-2xl max-h-60 overflow-y-auto">
            {state.status === 'loading' && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 text-homio-purple-300 animate-spin" />
              </div>
            )}

            {state.status === 'error' && (
              <p className="p-3 text-xs text-red-400">{state.message}</p>
            )}

            {state.status === 'ready' && filtered.length === 0 && !showCreateOption && (
              <p className="p-3 text-xs text-muted-foreground italic text-center">Nenhuma tag</p>
            )}

            {state.status === 'ready' &&
              filtered.map((opt) => {
                const selected = isSelected(opt.label);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (!selected) addTag(opt.label);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-secondary transition-colors ${
                      selected ? 'opacity-50' : 'text-foreground/90'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && <span className="text-xs text-muted-foreground">já adicionada</span>}
                  </button>
                );
              })}

            {showCreateOption && (
              <button
                type="button"
                onClick={createTag}
                disabled={creating}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-t border-border bg-homio-purple-500/5 text-homio-purple-200 hover:bg-homio-purple-500/15 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Criar tag &quot;{query.trim()}&quot;</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
