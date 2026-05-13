'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAgent } from '@/contexts/agent-context';
import type { AgentChannel, AgentResponseMode } from '@/lib/types';
import { Settings, Loader2, Send, MessageSquareDashed, Power, Instagram, MessageCircle, Crown, Check } from 'lucide-react';

const CHANNEL_OPTIONS: Array<{ value: AgentChannel; label: string; description: string; Icon: any; iconColor: string }> = [
  {
    value: 'whatsapp_homio',
    label: 'WhatsApp Homio',
    description: 'Conexão via Evolution API (whatsapp_homio)',
    Icon: MessageCircle,
    iconColor: 'text-emerald-300',
  },
  {
    value: 'whatsapp_meta',
    label: 'WhatsApp Meta',
    description: 'WhatsApp Business oficial (provider Meta)',
    Icon: MessageCircle,
    iconColor: 'text-emerald-400',
  },
  {
    value: 'instagram',
    label: 'Instagram',
    description: 'Mensagens diretas do Instagram',
    Icon: Instagram,
    iconColor: 'text-pink-300',
  },
];

const RESPONSE_MODE_OPTIONS: Array<{ value: AgentResponseMode; label: string; description: string; Icon: any; disabled?: boolean }> = [
  {
    value: 'responsive',
    label: 'Responsivo',
    description: 'Envia a resposta diretamente ao usuário (auto-pilot)',
    Icon: Send,
  },
  {
    value: 'suggestive',
    label: 'Sugestivo',
    description: 'Sugere respostas no GHL sem enviar (em breve)',
    Icon: MessageSquareDashed,
    disabled: true,
  },
];

export default function GeneralTabPage() {
  const { agent, setAgent, loading, updateAgent } = useAgent();
  const [companyName, setCompanyName] = useState('');

  if (!agent) return null;

  const toggleChannel = (channel: AgentChannel) => {
    setAgent((prev) => {
      if (!prev) return null;
      const current = Array.isArray(prev.enabled_channels) ? prev.enabled_channels : [];
      const next = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, enabled_channels: next };
    });
  };

  const setResponseMode = (mode: AgentResponseMode) => {
    setAgent((prev) => (prev ? { ...prev, response_mode: mode } : null));
  };

  const togglePrimary = () => {
    setAgent((prev) => (prev ? { ...prev, is_primary: !prev.is_primary } : null));
  };

  const enabledChannels = Array.isArray(agent.enabled_channels) ? agent.enabled_channels : [];

  return (
    <div className="space-y-8 animate-slide-up">
      <section className="space-y-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Informações Básicas</h3>
            <p className="text-muted-foreground">Configure as informações básicas do seu agent</p>
          </div>
          <Button
            variant={agent.is_primary ? 'default' : 'outline'}
            onClick={togglePrimary}
            className={agent.is_primary ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30' : ''}
          >
            <Crown className={`w-4 h-4 mr-2 ${agent.is_primary ? 'text-amber-300' : ''}`} />
            {agent.is_primary ? 'Primário' : 'Definir como Primário'}
          </Button>
        </div>

        {agent.is_primary && (
          <div className="flex items-start gap-2 px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-amber-200 text-xs">
            <Crown className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
            <span>
              Este é o agente <strong>primário</strong> da location. Quando a auto-ativação for habilitada,
              ele assumirá novas conversas automaticamente nos canais marcados. Por enquanto a flag fica
              registrada mas o comportamento atual (toggle manual) é preservado.
            </span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">Nome do Agent *</label>
            <Input
              value={agent.name}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              placeholder="Ex: Agente de Vendas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">Nome da Empresa</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Minha Empresa Ltda"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground/80 mb-2">Descrição</label>
            <Textarea
              value={agent.description || ''}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, description: e.target.value } : null))}
              placeholder="Descreva o propósito e função deste agent..."
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Modo de operação</h3>
          <p className="text-muted-foreground text-sm">Escolha como o agente reage a mensagens recebidas.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RESPONSE_MODE_OPTIONS.map((opt) => {
            const isActive = agent.response_mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => !opt.disabled && setResponseMode(opt.value)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  opt.disabled
                    ? 'border-border bg-secondary/30 opacity-50 cursor-not-allowed'
                    : isActive
                    ? 'border-homio-purple-500 bg-homio-purple-500/10'
                    : 'border-border bg-card hover:border-homio-purple-500/40 hover:bg-card/80'
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-homio-purple-500/20' : 'bg-secondary'
                  }`}>
                    <opt.Icon className={`w-4 h-4 ${isActive ? 'text-homio-purple-300' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="font-medium text-foreground">{opt.label}</div>
                  {isActive && !opt.disabled && <Check className="w-4 h-4 text-homio-purple-300 ml-auto" />}
                  {opt.disabled && <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Em breve</span>}
                </div>
                <div className="text-xs text-muted-foreground pl-12">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Canais habilitados</h3>
          <p className="text-muted-foreground text-sm">
            O agente só responde mensagens vindas dos canais selecionados.
            {enabledChannels.length === 0 && (
              <span className="block mt-1 text-red-300">
                Nenhum canal selecionado — o agente não vai responder a nada.
              </span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CHANNEL_OPTIONS.map((opt) => {
            const isOn = enabledChannels.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleChannel(opt.value)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  isOn
                    ? 'border-homio-purple-500 bg-homio-purple-500/10'
                    : 'border-border bg-card hover:border-homio-purple-500/40 hover:bg-card/80'
                }`}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isOn ? 'bg-homio-purple-500/20' : 'bg-secondary'
                  }`}>
                    <opt.Icon className={`w-4 h-4 ${isOn ? opt.iconColor : 'text-muted-foreground'}`} />
                  </div>
                  <div className="font-medium text-foreground flex-1">{opt.label}</div>
                  {isOn && <Check className="w-4 h-4 text-homio-purple-300" />}
                </div>
                <div className="text-xs text-muted-foreground pl-12">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            <Settings className="w-5 h-5 inline-block mr-2" />
            Configurações Avançadas
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">Status do Agent</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={agent.is_active}
                    onChange={() => setAgent((prev) => (prev ? { ...prev, is_active: true } : null))}
                    className="mr-2 text-homio-purple-600"
                  />
                  <span className="text-foreground/80">Ativo</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={!agent.is_active}
                    onChange={() => setAgent((prev) => (prev ? { ...prev, is_active: false } : null))}
                    className="mr-2 text-homio-purple-600"
                  />
                  <span className="text-foreground/80">Inativo</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            'Salvar Detalhes'
          )}
        </Button>
      </div>
    </div>
  );
}
