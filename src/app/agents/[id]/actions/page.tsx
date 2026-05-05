'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAgent } from '@/contexts/agent-context';
import { ActionTypeSelectorModal } from '@/components/agent-actions/ActionTypeSelectorModal';
import { ActionCard, type AgentActionRow } from '@/components/agent-actions/ActionCard';
import { ACTION_TYPE_META } from '@/lib/agent-action-display';
import type { ActionType } from '@/lib/types';
import { Loader2, Plus, Zap } from 'lucide-react';

export default function ActionsTabPage() {
  const { agentId, showMessage } = useAgent();

  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [pendingType, setPendingType] = useState<ActionType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentActionRow | null>(null);

  const fetchActions = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/actions`);
      if (!res.ok) throw new Error('Failed to fetch actions');
      const data = await res.json();
      setActions(data);
    } catch (error) {
      console.error('Error fetching actions:', error);
      showMessage('error', 'Erro ao carregar ações');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (agentId) fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleSelectType = (type: ActionType) => {
    setShowTypeSelector(false);
    setPendingType(type);
  };

  const handleEdit = (action: AgentActionRow) => {
    setPendingType(action.action_type);
    showMessage('info', `Edição da ação "${action.name}" — formulário disponível no próximo PR`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/actions/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete action');
      }
      setActions((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      showMessage('success', 'Ação excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting action:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao excluir ação');
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            <Zap className="w-5 h-5 inline-block mr-2" />
            Ações Configuradas
          </h3>
          <p className="text-muted-foreground text-sm">
            Workflows, follow-ups, handover e demais ações que o agent pode disparar durante a conversa
          </p>
        </div>
        <Button
          onClick={() => setShowTypeSelector(true)}
          disabled={busy}
          className="bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Ação
        </Button>
      </div>

      {fetching ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-homio-purple-300 animate-spin mb-3" />
          <p className="text-muted-foreground text-sm">Carregando ações...</p>
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary/40 border border-dashed border-border rounded-xl">
          <div className="w-16 h-16 bg-homio-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-homio-purple-300" />
          </div>
          <h4 className="text-foreground font-medium mb-2">Nenhuma ação configurada</h4>
          <p className="text-muted-foreground text-sm max-w-md">
            Adicione ações para que o agent possa disparar workflows, transferir conversas ou agendar
            compromissos automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
              loading={busy}
            />
          ))}
        </div>
      )}

      <ActionTypeSelectorModal
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelect={handleSelectType}
      />

      {pendingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingType(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {ACTION_TYPE_META[pendingType].label}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              O formulário deste tipo de ação chega no próximo PR (5b/7). Por enquanto a infraestrutura de
              lista, seleção e exclusão está disponível.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setPendingType(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
