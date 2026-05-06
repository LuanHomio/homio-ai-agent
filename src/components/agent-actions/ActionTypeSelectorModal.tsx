'use client';

import { Button } from '@/components/ui/button';
import { ACTION_TYPE_LIST } from '@/lib/agent-action-display';
import type { ActionType } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: ActionType) => void;
}

export function ActionTypeSelectorModal({ isOpen, onClose, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Adicionar Ação</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha o tipo de ação que o agent deve executar
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ACTION_TYPE_LIST.map((meta) => {
              const Icon = meta.icon;
              return (
                <button
                  key={meta.type}
                  onClick={() => onSelect(meta.type)}
                  className="text-left p-4 bg-secondary border border-border rounded-xl hover:border-homio-purple-500/40 hover:bg-secondary/70 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-homio-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-homio-purple-500/20 transition-colors">
                      <Icon className="w-5 h-5 text-homio-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-medium text-sm mb-1">{meta.label}</div>
                      <div className="text-muted-foreground text-xs">{meta.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
