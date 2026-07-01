'use client';

import {
  Activity,
  BookOpen,
  FileText,
  MessageCircle,
  MousePointerClick,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { usePlanCheckout } from './usePlanCheckout';
import { PlansGrid, NoticeBanner } from './PlansGrid';
import type { OverviewResponse } from './types';

// Capacidades do produto (o que o agente faz) — copy de vendas.
const FEATURES: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
  {
    icon: MessageCircle,
    title: 'Atende em todos os canais',
    desc: 'Responde no WhatsApp, Instagram Direct, e-mail, live chat e nos widgets do seu site — qualquer canal conectado na Homio, tudo no mesmo agente.',
  },
  {
    icon: FileText,
    title: 'Entende documentos, imagens e áudios',
    desc: 'Lê PDF, Word, planilhas e imagens, e transcreve áudios — interpreta o que o cliente envia e responde com contexto.',
  },
  {
    icon: BookOpen,
    title: 'Base de conhecimento própria',
    desc: 'Treine o agente com seus PDFs, planilhas e o site da empresa. As respostas ficam fiéis ao seu negócio, sem inventar.',
  },
  {
    icon: Workflow,
    title: 'Ações dentro do seu CRM',
    desc: 'Agenda reuniões, atualiza contatos, cria oportunidades, dispara workflows e transfere pra um humano quando precisa.',
  },
  {
    icon: Activity,
    title: 'Métricas e histórico',
    desc: 'Acompanhe cada conversa, o custo por mensagem e as decisões do agente numa timeline clara.',
  },
  {
    icon: MousePointerClick,
    title: 'Sem código',
    desc: 'Monte, ajuste o prompt e configure as ações do agente pela própria interface — sem tocar em nada técnico.',
  },
];

export function BillingLanding({ overview }: { overview: OverviewResponse }) {
  const { subscribe, checkoutSlug, notice } = usePlanCheckout();

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-homio-purple-500/10 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 text-homio-purple-300 text-xs font-semibold uppercase tracking-wide mb-4 px-3 py-1 rounded-full border border-homio-purple-500/30 bg-homio-purple-500/10">
            <Sparkles className="w-3.5 h-3.5" />
            Homio AI Agent
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground max-w-2xl mx-auto leading-tight">
            Coloque um agente de IA pra atender seus clientes automaticamente
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
            Atendimento automático, qualificação de leads e respostas com base no seu conteúdo —
            em todos os canais da Homio, integrado ao seu CRM. Assine um plano pra ativar seus
            agentes. Cancele quando quiser.
          </p>
          <div className="mt-7">
            <a
              href="#planos"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl
                bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 text-white
                hover:from-homio-purple-500 hover:to-homio-purple-400
                shadow-lg shadow-homio-purple-500/20 transition-all duration-300"
            >
              Ver planos
            </a>
          </div>
        </div>
      </div>

      {/* Capacidades */}
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-10 animate-slide-up">
          <h2 className="text-2xl font-bold text-foreground">O que o seu agente faz</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Tudo que você libera assinando um plano
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-2xl border border-border bg-card/40 hover:border-homio-purple-500/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-homio-purple-500/10 border border-homio-purple-500/20 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-homio-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Planos */}
        <div id="planos" className="scroll-mt-6">
          <div className="text-center mb-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-foreground">Escolha seu plano</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Todos incluem os recursos acima. A diferença é o volume de mensagens.
            </p>
          </div>

          {notice && (
            <div className="max-w-md mx-auto">
              <NoticeBanner notice={notice} />
            </div>
          )}

          <PlansGrid
            plans={overview.plans}
            currentSlug={overview.subscription?.plan_slug}
            checkoutSlug={checkoutSlug}
            onSubscribe={subscribe}
          />

          <p className="text-center text-xs text-muted-foreground mt-6">
            Pagamento seguro via Stripe. Sem fidelidade — cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
}
