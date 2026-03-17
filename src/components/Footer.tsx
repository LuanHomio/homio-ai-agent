'use client';

import { Target, BookOpen, Link2, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Personalização',
    description: 'Configure personalidade e objetivos',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description: 'Integre fontes de conhecimento',
  },
  {
    icon: Link2,
    title: 'Integração',
    description: 'Conecte com suas ferramentas',
  },
  {
    icon: BarChart3,
    title: 'Monitoramento',
    description: 'Acompanhe performance em tempo real',
  },
];

export function Footer() {
  return (
    <div className="border-t border-border py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-foreground">
            Recursos Principais
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((feature, i) => {
            const delayClass = i === 0 ? 'animate-slide-up' :
              i === 1 ? 'animate-slide-up-delay-1' :
              i === 2 ? 'animate-slide-up-delay-2' : 'animate-slide-up-delay-3';

            return (
              <div
                key={feature.title}
                className={`group rounded-xl p-5 border border-border bg-card card-hover text-center ${delayClass}`}
              >
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-homio-purple-500/10 border border-homio-purple-500/20 flex items-center justify-center group-hover:bg-homio-purple-500/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-homio-purple-400" strokeWidth={1.5} />
                </div>
                <div className="font-semibold text-sm text-foreground mb-1">
                  {feature.title}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <p className="text-xs text-muted-foreground/50">
            Powered by Homio
          </p>
        </div>
      </div>
    </div>
  );
}
