'use client';

import { Bot, Headphones, TrendingUp, Megaphone, Users, Zap, Pencil, Trash2 } from 'lucide-react';
import { Agent } from '@/lib/types';

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agentId: string) => void;
  onSelect?: (agentId: string) => void;
  isSelected?: boolean;
  showActions?: boolean;
  index?: number;
}

export function AgentCard({
  agent,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
  showActions = true,
  index = 0,
}: AgentCardProps) {
  const getAgentIcon = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('vendas') || name.includes('sales')) return TrendingUp;
    if (name.includes('suporte') || name.includes('support')) return Headphones;
    if (name.includes('marketing')) return Megaphone;
    if (name.includes('atendimento') || name.includes('service')) return Users;
    if (name.includes('chatbot')) return Bot;
    return Zap;
  };

  const getAgentAccent = (agentName: string) => {
    const name = agentName.toLowerCase();
    if (name.includes('vendas') || name.includes('sales'))
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    if (name.includes('suporte') || name.includes('support'))
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    if (name.includes('marketing'))
      return { bg: 'bg-homio-purple-400/10', text: 'text-homio-purple-400', border: 'border-homio-purple-400/20' };
    if (name.includes('atendimento') || name.includes('service'))
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
    if (name.includes('chatbot'))
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' };
    return { bg: 'bg-homio-purple-500/10', text: 'text-homio-purple-300', border: 'border-homio-purple-500/20' };
  };

  const Icon = getAgentIcon(agent.name);
  const accent = getAgentAccent(agent.name);

  const delayClass = index === 0 ? 'animate-slide-up' :
    index === 1 ? 'animate-slide-up-delay-1' :
    index === 2 ? 'animate-slide-up-delay-2' :
    index === 3 ? 'animate-slide-up-delay-3' : 'animate-slide-up-delay-4';

  return (
    <div
      className={`
        group relative rounded-xl p-6
        bg-card border border-border
        card-hover cursor-pointer
        ${isSelected ? 'ring-2 ring-homio-purple-500 border-homio-purple-500/40' : ''}
        ${delayClass}
      `}
      onClick={() => onEdit?.(agent)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${accent.bg} ${accent.border} border flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${accent.text}`} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground group-hover:text-homio-purple-400 transition-colors">
              {agent.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              AI Agent
            </p>
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          agent.is_active
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-muted text-muted-foreground border border-border'
        }`}>
          {agent.is_active ? 'Ativo' : 'Inativo'}
        </div>
      </div>

      {agent.description && (
        <p className="text-sm text-muted-foreground mb-5 line-clamp-2 leading-relaxed">
          {agent.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-5">
        <span className="text-muted-foreground/60">
          Criado em {new Date(agent.created_at).toLocaleDateString('pt-BR')}
        </span>
      </div>

      {showActions && (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(agent);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              bg-homio-purple-500/10 text-homio-purple-300 border border-homio-purple-500/20
              hover:bg-homio-purple-500/20 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(agent.id);
            }}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg
              text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent
              hover:border-red-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
