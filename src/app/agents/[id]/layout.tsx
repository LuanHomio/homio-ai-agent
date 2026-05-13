'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CopyableId } from '@/components/ui/copyable-id';
import { AgentProvider, useAgent } from '@/contexts/agent-context';
import { ArrowLeft, Loader2, Trash2, Check } from 'lucide-react';

const TABS = [
  { slug: 'general', label: 'Geral', description: 'Informações e status' },
  { slug: 'prompt', label: 'Prompt', description: 'Personalidade e objetivos' },
  { slug: 'knowledge', label: 'Base de Conhecimento', description: 'Fontes e FAQs' },
  { slug: 'actions', label: 'Ações', description: 'Workflows, handover, follow-up' },
  { slug: 'logs', label: 'Logs', description: 'Execuções e diagnostico' },
] as const;

function HeaderAndTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { agent, agentId, locationId, loading, updateAgent, deleteAgent } = useAgent();

  const qs = searchParams.toString();
  const buildHref = (slug: string) => `/agents/${agentId}/${slug}${qs ? `?${qs}` : ''}`;
  // Voltar leva pra page inicial (lista de agents da location). Antes ia pra /agents/{locationId}
  // que e rota inexistente — caia no /agents/[id] tentando carregar agent UUID = location e quebrava.
  const backHref = locationId ? `/?locationId=${encodeURIComponent(locationId)}` : '/';
  const activeSlug = TABS.find((t) => new RegExp(`/${t.slug}(/|$)`).test(pathname))?.slug ?? 'general';

  if (!agent) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-homio-purple-500 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Carregando agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="bg-card border-b border-border animate-fade-in">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{agent.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground">Configure seu agent de IA para automatizar conversas</p>
                <CopyableId id={agent.id} label="Agent ID" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push(backHref)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button variant="destructive" onClick={deleteAgent} disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
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
                  <>
                    <Check className="w-4 h-4 mr-2" /> Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 animate-slide-up">
        <div className="bg-card rounded-xl border border-border mb-6">
          <div className="border-b border-border">
            <div className="flex space-x-1 px-6">
              {TABS.map((tab) => {
                const isActive = activeSlug === tab.slug;
                return (
                  <Link
                    key={tab.slug}
                    href={buildHref(tab.slug)}
                    replace
                    scroll={false}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-homio-purple-500 text-homio-purple-300 bg-homio-purple-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground/80 hover:border-border'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-lg">{tab.label}</span>
                      <span className="text-xs opacity-75">{tab.description}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  // Hook so we can read locationId from URL once and pass into provider
  return <AgentLayoutInner agentId={params.id}>{children}</AgentLayoutInner>;
}

function AgentLayoutInner({ agentId, children }: { agentId: string; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') || '';

  return (
    <AgentProvider agentId={agentId} locationId={locationId}>
      <HeaderAndTabs>{children}</HeaderAndTabs>
    </AgentProvider>
  );
}
