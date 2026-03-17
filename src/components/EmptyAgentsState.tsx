'use client';

import { Bot, Plus, ArrowRight } from 'lucide-react';

interface EmptyAgentsStateProps {
  onCreateAgent: () => void;
}

export function EmptyAgentsState({ onCreateAgent }: EmptyAgentsStateProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center animate-fade-in">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-homio-purple-500/10 border border-homio-purple-500/20 flex items-center justify-center animate-float">
            <Bot className="w-10 h-10 text-homio-purple-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Nenhum Agent Criado
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Comece criando seu primeiro agent de IA para automatizar conversas e melhorar a experiencia do seu cliente.
          </p>
        </div>

        <div className="rounded-xl p-8 border border-border bg-card">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-homio-purple-500/10 border border-homio-purple-500/20 flex items-center justify-center">
            <Plus className="w-6 h-6 text-homio-purple-400" />
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">
            Criar Primeiro Agent
          </h4>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Configure personalidade, objetivos e integre com suas fontes de conhecimento.
          </p>

          <button
            onClick={onCreateAgent}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl
              bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 text-white
              hover:from-homio-purple-500 hover:to-homio-purple-400
              shadow-lg shadow-homio-purple-500/20 hover:shadow-homio-purple-500/30
              transition-all duration-300"
          >
            Criar Primeiro Agent
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
