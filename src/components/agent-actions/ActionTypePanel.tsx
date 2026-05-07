'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ACTION_TYPE_META } from '@/lib/agent-action-display';
import type { ActionType } from '@/lib/types';
import { Plus, Trash2, X } from 'lucide-react';
import type { AgentActionRow } from './ActionCard';
import { ActionForm } from './ActionForm';

export interface Props {
  isOpen: boolean;
  agentId: string;
  actionType: ActionType | null;
  /** Todas as actions desse tipo (vindas do parent — filtradas). */
  actionsOfType: AgentActionRow[];
  onClose: () => void;
  onSaved: (saved: AgentActionRow) => void;
  onDeleted: (id: string) => void;
}

type Selection = { mode: 'create' } | { mode: 'edit'; actionId: string };

export function ActionTypePanel({
  isOpen,
  agentId,
  actionType,
  actionsOfType,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ mode: 'create' });
  const [deleteTarget, setDeleteTarget] = useState<AgentActionRow | null>(null);
  const [busy, setBusy] = useState(false);

  // Ao abrir o panel pra um novo tipo, ou se a lista esvazia, volta pro modo create
  useEffect(() => {
    if (!isOpen) return;
    if (selection.mode === 'edit') {
      const stillExists = actionsOfType.some((a) => a.id === selection.actionId);
      if (!stillExists) setSelection({ mode: 'create' });
    }
  }, [isOpen, actionsOfType, selection]);

  // Reset selection ao trocar de tipo
  useEffect(() => {
    if (isOpen && actionType) {
      setSelection({ mode: 'create' });
    }
  }, [isOpen, actionType]);

  const meta = actionType ? ACTION_TYPE_META[actionType] : null;
  const editAction = useMemo(() => {
    if (selection.mode !== 'edit') return null;
    return actionsOfType.find((a) => a.id === selection.actionId) ?? null;
  }, [selection, actionsOfType]);

  if (!isOpen || !actionType || !meta) return null;
  const Icon = meta.icon;

  const handleSaved = (saved: AgentActionRow) => {
    onSaved(saved);
    setSelection({ mode: 'edit', actionId: saved.id });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/actions/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      onDeleted(deleteTarget.id);
      if (selection.mode === 'edit' && selection.actionId === deleteTarget.id) {
        setSelection({ mode: 'create' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-homio-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-homio-purple-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">{meta.label}</h2>
                <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-1 min-h-0">
            <aside className="w-64 border-r border-border bg-secondary/20 flex flex-col">
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {actionsOfType.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-2 py-3 text-center">
                    Nenhuma ação desse tipo ainda.
                  </p>
                ) : (
                  actionsOfType.map((a) => {
                    const isSelected = selection.mode === 'edit' && selection.actionId === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-homio-purple-500/15 text-homio-purple-100'
                            : 'hover:bg-secondary text-foreground/80'
                        }`}
                        onClick={() => setSelection({ mode: 'edit', actionId: a.id })}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.is_active ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                        <span className="flex-1 min-w-0 truncate">{a.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(a);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelection({ mode: 'create' })}
                  disabled={selection.mode === 'create'}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova ação
                </Button>
              </div>
            </aside>

            <main className="flex-1 min-w-0 flex flex-col">
              <ActionForm
                key={selection.mode === 'edit' ? `edit:${selection.actionId}` : `create:${actionType}`}
                agentId={agentId}
                actionType={actionType}
                editAction={editAction}
                onSaved={handleSaved}
                onCancel={onClose}
              />
            </main>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir Ação"
        message={
          deleteTarget
            ? `Tem certeza que deseja excluir a ação "${deleteTarget.name}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </>
  );
}
