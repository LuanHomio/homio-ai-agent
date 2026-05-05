'use client';

import { Zap } from 'lucide-react';

export default function ActionsTabPage() {
  return (
    <div className="animate-slide-up">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-homio-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-homio-purple-300" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Configuração de Ações</h3>
        <p className="text-muted-foreground max-w-md">
          Em breve. Esta tab vai permitir configurar workflows, handover humano, follow-ups e demais ações
          do agent — paridade com o Conversation AI nativo do GHL.
        </p>
      </div>
    </div>
  );
}
