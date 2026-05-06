'use client';

import { Button } from '@/components/ui/button';
import { ACTION_TYPE_META } from '@/lib/agent-action-display';
import type { ActionType } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';

export type AgentActionRow = {
  id: string;
  agent_id: string;
  action_type: ActionType;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

interface Props {
  action: AgentActionRow;
  onEdit: (action: AgentActionRow) => void;
  onDelete: (action: AgentActionRow) => void;
  loading?: boolean;
}

export function ActionCard({ action, onEdit, onDelete, loading }: Props) {
  const meta = ACTION_TYPE_META[action.action_type];
  const Icon = meta.icon;

  return (
    <div className="bg-secondary border border-border rounded-xl p-4 hover:border-homio-purple-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-homio-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-homio-purple-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-foreground font-medium text-sm truncate">{action.name}</span>
              {!action.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                  Inativo
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mb-2">{meta.label}</div>
            {action.description && (
              <p className="text-xs text-foreground/70 line-clamp-2">{action.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => onEdit(action)} disabled={loading}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(action)} disabled={loading}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
