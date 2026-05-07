'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useGhlOptions, type GhlOption } from './use-ghl-options';
import { Check, ChevronDown, Loader2, X, AlertCircle, RefreshCw } from 'lucide-react';

type CommonProps = {
  resource: string;
  locationId: string | undefined;
  extraParams?: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
};

type SingleProps = CommonProps & {
  multi?: false;
  value: string;
  onChange: (id: string, option: GhlOption | null) => void;
};

type MultiProps = CommonProps & {
  multi: true;
  value: string[];
  onChange: (ids: string[], options: GhlOption[]) => void;
};

export type Props = SingleProps | MultiProps;

export function GhlSelect(props: Props) {
  const { resource, locationId, extraParams, placeholder, disabled } = props;
  const state = useGhlOptions(resource, locationId, extraParams);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click fora fecha
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
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  const isSelected = (id: string) => {
    if (props.multi) return props.value.includes(id);
    return props.value === id;
  };

  const toggle = (option: GhlOption) => {
    if (props.multi) {
      if (props.value.includes(option.id)) {
        const next = props.value.filter((v) => v !== option.id);
        props.onChange(
          next,
          items.filter((i) => next.includes(i.id)),
        );
      } else {
        const next = [...props.value, option.id];
        props.onChange(
          next,
          items.filter((i) => next.includes(i.id)),
        );
      }
    } else {
      props.onChange(option.id, option);
      setOpen(false);
      setQuery('');
    }
  };

  const removeMulti = (id: string) => {
    if (!props.multi) return;
    const next = props.value.filter((v) => v !== id);
    props.onChange(
      next,
      items.filter((i) => next.includes(i.id)),
    );
  };

  // Texto exibido no botao quando fechado
  const displayLabel = (() => {
    if (state.status === 'loading') return 'Carregando...';
    if (state.status === 'error') return 'Erro ao carregar';
    if (state.status !== 'ready') return placeholder ?? 'Selecione...';
    if (props.multi) {
      if (props.value.length === 0) return placeholder ?? 'Nenhum selecionado';
      return `${props.value.length} selecionado${props.value.length > 1 ? 's' : ''}`;
    }
    const selected = items.find((i) => i.id === props.value);
    return selected?.label ?? props.value ?? placeholder ?? 'Selecione...';
  })();

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 p-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground hover:border-homio-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed focus:border-homio-purple-500/60 focus:outline-none"
      >
        <span className={`truncate ${state.status !== 'ready' || (props.multi ? props.value.length === 0 : !props.value) ? 'text-muted-foreground' : ''}`}>
          {displayLabel}
        </span>
        {state.status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-muted-foreground" />
        ) : state.status === 'error' ? (
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
        ) : (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Chips em modo multi (abaixo do trigger) */}
      {props.multi && props.value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {props.value.map((id) => {
            const opt = items.find((i) => i.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-homio-purple-500/15 text-homio-purple-100 text-xs rounded-md"
              >
                <span className="truncate max-w-[200px]">{opt?.label ?? id}</span>
                <button
                  type="button"
                  onClick={() => removeMulti(id)}
                  className="text-homio-purple-200 hover:text-red-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-2xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {state.status === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-homio-purple-300 animate-spin" />
              </div>
            )}

            {state.status === 'error' && (
              <div className="p-3 text-sm">
                <p className="text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {state.message}
                </p>
                <button
                  type="button"
                  onClick={state.reload}
                  className="text-xs text-homio-purple-300 hover:text-homio-purple-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Tentar novamente
                </button>
              </div>
            )}

            {state.status === 'ready' && filteredItems.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground italic text-center">
                {items.length === 0 ? 'Nenhuma opção disponível' : 'Nada encontrado'}
              </p>
            )}

            {state.status === 'ready' &&
              filteredItems.map((opt) => {
                const selected = isSelected(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-secondary transition-colors ${
                      selected ? 'bg-homio-purple-500/10 text-homio-purple-100' : 'text-foreground/90'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-xs text-muted-foreground truncate">{opt.sublabel}</div>
                      )}
                    </div>
                    {selected && <Check className="w-4 h-4 flex-shrink-0 text-homio-purple-300" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
