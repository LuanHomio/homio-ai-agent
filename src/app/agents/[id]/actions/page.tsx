'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAgent } from '@/contexts/agent-context';
import { ActionTypeCardGrid } from '@/components/agent-actions/ActionTypeCardGrid';
import { ActionTypePanel } from '@/components/agent-actions/ActionTypePanel';
import type { AgentActionRow } from '@/components/agent-actions/ActionCard';
import { ACTION_TYPES, type ActionType } from '@/lib/types';
import { Loader2, Zap } from 'lucide-react';

export default function ActionsTabPage() {
  const { agentId, locationId, showMessage } = useAgent();

  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [openType, setOpenType] = useState<ActionType | null>(null);

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

  const counts = useMemo(() => {
    const map = Object.fromEntries(ACTION_TYPES.map((t) => [t, 0])) as Record<ActionType, number>;
    actions.forEach((a) => {
      const t = a.action_type as ActionType;
      if (t in map) map[t] = (map[t] ?? 0) + 1;
    });
    return map;
  }, [actions]);

  const actionsOfOpenType = useMemo(
    () => (openType ? actions.filter((a) => a.action_type === openType) : []),
    [actions, openType],
  );

  const handleSaved = (saved: AgentActionRow) => {
    setActions((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      if (exists) return prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a));
      return [...prev, saved];
    });
    showMessage('success', 'Ação salva com sucesso!');
  };

  const handleDeleted = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
    showMessage('success', 'Ação excluída com sucesso!');
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          <Zap className="w-5 h-5 inline-block mr-2" />
          Configure suas Ações
        </h3>
        <p className="text-muted-foreground text-sm">
          Workflows, follow-ups, handover e demais ações que o agent pode disparar durante a conversa.
          Clique num tipo para criar/editar.
        </p>
      </div>

      {fetching ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-homio-purple-300 animate-spin mb-3" />
          <p className="text-muted-foreground text-sm">Carregando ações...</p>
        </div>
      ) : (
        <ActionTypeCardGrid counts={counts} onSelect={setOpenType} />
      )}

      <ActionTypePanel
        isOpen={openType !== null}
        agentId={agentId}
        locationId={locationId}
        actionType={openType}
        actionsOfType={actionsOfOpenType}
        onClose={() => setOpenType(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
