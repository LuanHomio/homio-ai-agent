'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Agent, UpdateAgentRequest } from '@/lib/types';
import { promptToMarkdown } from '@/lib/prompt-formatter';
import { DangerConfirmModal } from '@/components/ui/danger-confirm-modal';

type MessageType = 'success' | 'error' | 'warning' | 'info';

type AgentContextValue = {
  agentId: string;
  locationId: string;
  agent: Agent | null;
  setAgent: (updater: (prev: Agent | null) => Agent | null) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showMessage: (type: MessageType, text: string) => void;
  updateAgent: () => Promise<void>;
  deleteAgent: () => Promise<void>;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

export function AgentProvider({
  agentId,
  locationId,
  children,
}: {
  agentId: string;
  locationId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [agent, setAgentState] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const setAgent = (updater: (prev: Agent | null) => Agent | null) => {
    setAgentState(updater);
  };

  const showMessage = (type: MessageType, text: string) => {
    if (type === 'success') toast.success(text);
    else if (type === 'error') toast.error(text);
    else if (type === 'warning') toast.warning(text);
    else toast.info(text);
  };

  const fetchAgent = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch agent');
      const agentData = await response.json();
      setAgentState(agentData);
    } catch (error) {
      console.error('Error fetching agent:', error);
      showMessage('error', 'Erro ao carregar agent');
    }
  };

  const updateAgent = async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const markdownPrompt = promptToMarkdown(agent, {
        includeHeader: true,
        includeMetadata: false,
        formatLists: true,
        separator: '\n\n---\n\n',
      });

      const updateData: UpdateAgentRequest = {
        name: agent.name,
        description: agent.description,
        personality: agent.personality,
        objective: agent.objective,
        additional_info: agent.additional_info,
        system_prompt: markdownPrompt,
        settings: agent.settings,
        is_active: agent.is_active,
      };

      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update agent');
      }

      const updatedAgent = await response.json();
      setAgentState(updatedAgent);
      showMessage('success', 'Agent atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating agent:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar agent');
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal de confirmacao destrutiva. A delecao real acontece em
  // performDelete() quando o usuario digita o nome e confirma.
  const deleteAgent = async () => {
    setConfirmingDelete(true);
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete agent');
      toast.success('Agent excluído com sucesso!');
      setConfirmingDelete(false);
      router.push(`/?locationId=${locationId}`);
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir agent');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (agentId) fetchAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  return (
    <AgentContext.Provider
      value={{
        agentId,
        locationId,
        agent,
        setAgent,
        loading,
        setLoading,
        showMessage,
        updateAgent,
        deleteAgent,
      }}
    >
      {children}

      <DangerConfirmModal
        isOpen={confirmingDelete}
        onClose={() => !deleting && setConfirmingDelete(false)}
        onConfirm={performDelete}
        busy={deleting}
        title={agent ? `Excluir agente "${agent.name}"` : 'Excluir agente'}
        confirmPhrase={agent?.name ?? ''}
        confirmButtonText="Excluir definitivamente"
        description={
          <div className="space-y-3">
            <p>
              Você está prestes a excluir <strong>permanentemente</strong> este agente. Os seguintes dados
              serão removidos junto:
            </p>
            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 pl-1">
              <li>Todas as bases de conhecimento e fontes vinculadas</li>
              <li>Todas as ações configuradas (workflows, follow-ups, handover etc)</li>
              <li>Histórico de conversas que dependiam deste agent</li>
              <li>Configuração de prompt, personalidade e objetivos</li>
            </ul>
            <p className="text-red-300 font-medium">
              Esta operação não pode ser desfeita.
            </p>
          </div>
        }
      />
    </AgentContext.Provider>
  );
}
