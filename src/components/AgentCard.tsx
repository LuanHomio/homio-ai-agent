'use client';

import { Button } from '@/components/ui/button';
import { Agent } from '@/lib/types';

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agentId: string) => void;
  onSelect?: (agentId: string) => void;
  isSelected?: boolean;
  showActions?: boolean;
}

export function AgentCard({ 
  agent, 
  onEdit, 
  onDelete, 
  onSelect, 
  isSelected = false,
  showActions = true 
}: AgentCardProps) {
  const getAgentIcon = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('vendas') || name.includes('sales')) return '💰';
    if (name.includes('suporte') || name.includes('support')) return '🎧';
    if (name.includes('marketing')) return '📢';
    if (name.includes('atendimento') || name.includes('service')) return '🤝';
    if (name.includes('chatbot')) return '🤖';
    return '⚡';
  };

  const getAgentColor = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('vendas') || name.includes('sales')) return 'text-green-400';
    if (name.includes('suporte') || name.includes('support')) return 'text-blue-400';
    if (name.includes('marketing')) return 'text-purple-400';
    if (name.includes('atendimento') || name.includes('service')) return 'text-orange-400';
    if (name.includes('chatbot')) return 'text-cyan-400';
    return 'text-gray-400';
  };

  return (
    <div 
      className={`bg-gray-800 rounded-lg p-6 border border-gray-700 cursor-pointer transition-all hover:border-gray-600 hover:shadow-xl ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''
      }`}
      onClick={() => onEdit?.(agent)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`text-2xl ${getAgentColor(agent.name)}`}>
            {getAgentIcon(agent.name)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              {agent.name}
            </h3>
            <p className="text-sm text-gray-400">
              AI Agent
            </p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          agent.is_active 
            ? 'bg-green-900/30 text-green-400 border border-green-800' 
            : 'bg-gray-700 text-gray-400 border border-gray-600'
        }`}>
          {agent.is_active ? 'Ativo' : 'Inativo'}
        </div>
      </div>

      {agent.description && (
        <p className="text-gray-300 text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span>👤</span>
            <span>1</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>⭐</span>
            <span>4.8</span>
            <span>(12)</span>
          </div>
        </div>
        <div className="text-gray-600">
          {new Date(agent.created_at).toLocaleDateString('pt-BR')}
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(agent);
            }}
            className="flex-1"
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(agent.id);
            }}
            className="flex-1"
          >
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
