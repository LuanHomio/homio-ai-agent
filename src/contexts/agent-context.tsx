'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Agent, UpdateAgentRequest } from '@/lib/types';
import { promptToMarkdown } from '@/lib/prompt-formatter';

type MessageType = 'success' | 'error' | 'warning' | 'info';
export type Message = { type: MessageType; text: string } | null;

type AgentContextValue = {
  agentId: string;
  locationId: string;
  agent: Agent | null;
  setAgent: (updater: (prev: Agent | null) => Agent | null) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  message: Message;
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
  const [message, setMessage] = useState<Message>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setAgent = (updater: (prev: Agent | null) => Agent | null) => {
    setAgentState(updater);
  };

  const showMessage = (type: MessageType, text: string) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setMessage({ type, text });
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 5000);
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

  const deleteAgent = async () => {
    if (!confirm('Tem certeza que deseja excluir este agent?')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete agent');
      showMessage('success', 'Agent excluído com sucesso!');
      router.push(`/?locationId=${locationId}`);
    } catch (error) {
      console.error('Error deleting agent:', error);
      showMessage('error', 'Erro ao excluir agent');
    } finally {
      setLoading(false);
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
        message,
        showMessage,
        updateAgent,
        deleteAgent,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}
