'use client';

import { Button } from '@/components/ui/button';

interface EmptyAgentsStateProps {
  onCreateAgent: () => void;
}

export function EmptyAgentsState({ onCreateAgent }: EmptyAgentsStateProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Nenhum Agent Criado
          </h3>
          <p className="text-gray-400 mb-6">
            Comece criando seu primeiro agent de IA para automatizar conversas e melhorar a experiência do seu cliente.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          <div className="text-4xl mb-4">⚡</div>
          <h4 className="text-lg font-semibold text-white mb-2">
            Criar Primeiro Agent
          </h4>
          <p className="text-gray-400 text-sm mb-6">
            Configure personalidade, objetivos e integre com suas fontes de conhecimento.
          </p>
          
          <Button
            onClick={onCreateAgent}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg w-full"
          >
            + Criar Primeiro Agent
          </Button>
        </div>
      </div>
    </div>
  );
}
