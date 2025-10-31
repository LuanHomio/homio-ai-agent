'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AgentCard } from '@/components/AgentCard';
import { Agent, Location } from '@/lib/types';

interface AgentsManagerProps {
  selectedLocationId?: string;
  onAgentSelect?: (agentId: string) => void;
  selectedAgentId?: string;
}

export function AgentsManager({ selectedLocationId, onAgentSelect, selectedAgentId }: AgentsManagerProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) throw new Error('Failed to fetch locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchAgents = async () => {
    if (!selectedLocationId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/agents?location_id=${selectedLocationId}`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      showMessage('error', 'Erro ao carregar agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = () => {
    router.push(`/agents/new?locationId=${selectedLocationId}`);
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agent?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      showMessage('success', 'Agent excluído com sucesso!');
    } catch (error) {
      console.error('Error deleting agent:', error);
      showMessage('error', 'Erro ao excluir agent');
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Carregando...';
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [selectedLocationId]);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-900/30 text-green-400 border border-green-800' 
            : 'bg-red-900/30 text-red-400 border border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Meus Agents</h2>
          <p className="text-gray-400 mt-1">
            Gerencie seus agents de IA
          </p>
          {selectedLocationId && (
            <p className="text-sm text-gray-600 mt-1">
              Location: {getLocationName(selectedLocationId)}
            </p>
          )}
        </div>
        <Button
          onClick={handleCreateAgent}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Novo Agent
        </Button>
      </div>

      {loading && agents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Carregando agents...</div>
      ) : agents.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700 text-center p-12">
          <CardContent className="p-0">
            <div className="text-6xl mb-6">✨</div>
            <h3 className="text-2xl font-bold text-white mb-4">
              Nenhum Agent Criado Ainda!
            </h3>
            <p className="text-gray-400 mb-8">
              Parece que você ainda não tem nenhum agente de IA nesta location.
              Comece a automatizar suas conversas criando o primeiro!
            </p>
            <Button
              onClick={handleCreateAgent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
            >
              Criar Primeiro Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onSelect={onAgentSelect}
              onEdit={(agent) => {
                router.push(`/agents/${agent.id}?locationId=${selectedLocationId}`);
              }}
              onDelete={deleteAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}