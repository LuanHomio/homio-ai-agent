'use client';

import { Bot, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onCreateAgent?: () => void;
  agentsCount?: number;
  locationName?: string;
  locationId?: string;
}

export function HeroSection({ onCreateAgent, agentsCount = 0, locationName = 'Sua Location', locationId }: HeroSectionProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-homio-purple-600 via-homio-purple-500 to-homio-purple-800 animate-gradient py-16 px-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-homio-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-homio-purple-400/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4 text-homio-purple-200" />
            <span className="text-sm font-medium text-homio-purple-100">
              {agentsCount} {agentsCount === 1 ? 'agent ativo' : 'agents ativos'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-5 animate-slide-up">
            <Bot className="w-10 h-10 text-white/90" strokeWidth={1.5} />
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              AI Agent Manager
            </h1>
          </div>

          <p className="text-lg text-homio-purple-100/80 max-w-2xl mx-auto font-medium animate-slide-up-delay-1">
            Crie e gerencie agentes de IA inteligentes para automatizar conversas e
            melhorar a experiencia do seu cliente.
          </p>

          {locationName && (
            <div className="mt-6 animate-slide-up-delay-2">
              <span className="text-sm text-homio-purple-200/60 font-medium">
                {locationName}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
