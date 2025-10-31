'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface HeroSectionProps {
  onCreateAgent?: () => void;
  agentsCount?: number;
  locationName?: string;
  locationId?: string;
}

export function HeroSection({ onCreateAgent, agentsCount = 0, locationName = 'Sua Location', locationId }: HeroSectionProps) {
  return (
    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            🤖 AI Agent Manager
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Crie e gerencie agentes de IA inteligentes para automatizar conversas e 
            melhorar a experiência do seu cliente.
          </p>
        </div>
      </div>
    </div>
  );
}
