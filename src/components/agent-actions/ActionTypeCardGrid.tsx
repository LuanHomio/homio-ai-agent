'use client';

import { ACTION_TYPE_LIST } from '@/lib/agent-action-display';
import type { ActionType } from '@/lib/types';

export interface Props {
  /** Contagem por tipo (calculada a partir das actions atuais). */
  counts: Record<ActionType, number>;
  onSelect: (type: ActionType) => void;
}

export function ActionTypeCardGrid({ counts, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {ACTION_TYPE_LIST.map((meta) => {
        const Icon = meta.icon;
        const count = counts[meta.type] ?? 0;
        return (
          <button
            key={meta.type}
            type="button"
            onClick={() => onSelect(meta.type)}
            className="group relative flex items-start gap-3 text-left p-4 bg-secondary/40 border border-border hover:border-homio-purple-500/40 hover:bg-homio-purple-500/5 rounded-xl transition-all"
          >
            <div className="w-10 h-10 bg-homio-purple-500/10 group-hover:bg-homio-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
              <Icon className="w-5 h-5 text-homio-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground truncate">{meta.label}</h4>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-homio-purple-500/20 text-homio-purple-200 text-xs font-medium">
                    {count}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{meta.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
