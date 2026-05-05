'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { useAgent } from '@/contexts/agent-context';
import { FileText, Loader2, HelpCircle } from 'lucide-react';

export default function PromptTabPage() {
  const { agent, setAgent, loading, updateAgent } = useAgent();

  if (!agent) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          <FileText className="w-5 h-5 inline-block mr-2" />
          Configuração de Prompt
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              <span className="flex items-center">
                Personalidade
                <Tooltip content="O bot é você ou seu assistente? Ele é formal ou sarcástico? Diga ao bot quem ele é e como pode atingir seus objetivos e coisas para ter em mente ao falar com o contato.">
                  <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1">
                    <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </span>
                </Tooltip>
              </span>
            </label>
            <Textarea
              value={agent.personality || ''}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, personality: e.target.value } : null))}
              placeholder="Ex: Amigável, profissional, focado em resultados..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              <span className="flex items-center">
                Objetivo
                <Tooltip content="O objetivo do bot. Use este espaço para definir qual é o objetivo do bot, como auxiliar com respostas a perguntas, agendar consultas, etc.">
                  <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1">
                    <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </span>
                </Tooltip>
              </span>
            </label>
            <Textarea
              value={agent.objective || ''}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, objective: e.target.value } : null))}
              placeholder="Ex: Atender dúvidas sobre produtos, agendar consultas..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              <span className="flex items-center">
                Informações Adicionais
                <Tooltip content="Informações importantes do negócio, por que a conversa está acontecendo, quem é o contato, regras a seguir, etc. Adicione qualquer coisa que o bot precise saber para ajudá-lo a automatizar suas conversas e responder aos seus contatos.">
                  <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1">
                    <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </span>
                </Tooltip>
              </span>
            </label>
            <Textarea
              value={agent.additional_info || ''}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, additional_info: e.target.value } : null))}
              placeholder="Ex: Horário de funcionamento, políticas da empresa, informações de contato..."
              rows={4}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={updateAgent}
          disabled={loading}
          className="bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
            </>
          ) : (
            'Salvar Prompt'
          )}
        </Button>
      </div>
    </div>
  );
}
