'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { Agent, CreateAgentRequest, KnowledgeBase } from '@/lib/types';
import { Settings, MessageSquare, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';

export default function NewAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') || 'd8voPwkhJK7k7S5xjHcA';

  const [activeTab, setActiveTab] = useState('configuracoes');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [agent, setAgent] = useState<CreateAgentRequest>({
    location_id: locationId,
    name: '',
    description: '',
    personality: '',
    objective: '',
    additional_info: '',
    system_prompt: '',
    dify_app_id: '',
    settings: {}
  });

  const [companyName, setCompanyName] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchKnowledgeBases = async () => {
    try {
      const response = await fetch(`/api/knowledge-bases?location_id=${locationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }
      const data = await response.json();
      setKnowledgeBases(data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      showMessage('error', 'Erro ao carregar bases de conhecimento');
    }
  };

  const createAgent = async () => {
    if (!agent.name) {
      showMessage('error', 'Nome do agent é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create agent');
      }

      const createdAgent = await response.json();

      // Update knowledge bases if any are selected
      if (selectedKnowledgeBases.length > 0) {
        const kbResponse = await fetch(`/api/agents/${createdAgent.id}/knowledge-bases`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge_base_ids: selectedKnowledgeBases })
        });

        if (!kbResponse.ok) {
          console.warn('Agent created but failed to update knowledge bases');
        }
      }

      showMessage('success', 'Agent criado com sucesso!');

      // Redirect to agent edit page
      router.push(`/agents/${createdAgent.id}?locationId=${locationId}`);
    } catch (error) {
      console.error('Error creating agent:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar agent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, [locationId]);

  const tabs = [
    { id: 'configuracoes', label: 'Configurações', icon: Settings, description: 'Detalhes básicos do agent' },
    { id: 'prompt', label: 'Prompt', icon: MessageSquare, description: 'Personalidade e objetivos' },
    { id: 'conhecimento', label: 'Base de Conhecimento', icon: BookOpen, description: 'Fontes e FAQs' }
  ];

  return (
    <div className="min-h-screen bg-background dark animate-fade-in">
      {/* Header Section */}
      <div className="bg-card border-b border-border animate-slide-up">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {agent.name || 'Novo Agent'}
              </h1>
              <p className="text-muted-foreground">
                Configure seu agent de IA para automatizar conversas
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
              >
                Cancelar
              </Button>
              <Button
                onClick={createAgent}
                disabled={loading || !agent.name}
                className="bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20 text-white"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : 'Criar Agent'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8">
        {message && (
          <div className={`p-4 rounded-md mb-6 ${
            message.type === 'success'
              ? 'bg-green-900/30 text-green-400 border border-green-800'
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Bot Details Section */}
        <div className="bg-card rounded-lg p-6 border border-border mb-6 animate-slide-up-delay-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Detalhes do Agent</h2>
              <p className="text-muted-foreground">Configure as informações básicas do seu agent</p>
            </div>
            <Button
              variant="outline"
              className="border-homio-purple-500/20 text-homio-purple-300 bg-homio-purple-500/10 hover:bg-homio-purple-500/20"
            >
              Definir como Principal
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Nome do Agent *
              </label>
              <Input
                value={agent.name}
                onChange={(e) => setAgent(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Agente de Vendas"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Nome da Empresa
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Minha Empresa Ltda"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Descrição
              </label>
              <Textarea
                value={agent.description}
                onChange={(e) => setAgent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o propósito e função deste agent..."
                rows={3}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-card rounded-lg border border-border mb-6 animate-slide-up-delay-2">
          <div className="border-b border-border">
            <div className="flex space-x-1 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-homio-purple-500 text-homio-purple-300 bg-homio-purple-500/10'
                      : 'border-transparent text-muted-foreground hover:text-foreground/80 hover:border-border'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-lg flex items-center gap-2">
                      <tab.icon className="h-5 w-5" />
                      {tab.label}
                    </span>
                    <span className="text-xs opacity-75">{tab.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'configuracoes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Configurações Avançadas</h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        Dify App ID
                      </label>
                      <Input
                        value={agent.dify_app_id}
                        onChange={(e) => setAgent(prev => ({ ...prev, dify_app_id: e.target.value }))}
                        placeholder="ID da aplicação no Dify (opcional)"
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        Status do Agent
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="active"
                            defaultChecked
                            className="mr-2 accent-homio-purple-500"
                          />
                          <span className="text-foreground/80">Ativo</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="inactive"
                            className="mr-2 accent-homio-purple-500"
                          />
                          <span className="text-foreground/80">Inativo</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Configuração de Prompt</h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        <Tooltip content="Is the bot you or your assistant? Are they formal or sarcastic? Tell the bot who it is and how it can meet its goals and things to keep in mind while talking to the contact.">
                          <span className="cursor-help">Personalidade ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.personality}
                        onChange={(e) => setAgent(prev => ({ ...prev, personality: e.target.value }))}
                        placeholder="Ex: Amigável, profissional, focado em resultados..."
                        rows={3}
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        <Tooltip content="The bot's goal. Use this space to define what the bot's goal is like assisting with question answers, booking an appointment etc.">
                          <span className="cursor-help">Objetivo ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.objective}
                        onChange={(e) => setAgent(prev => ({ ...prev, objective: e.target.value }))}
                        placeholder="Ex: Atender dúvidas sobre produtos, agendar consultas..."
                        rows={3}
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        <Tooltip content="Important Business info, why the conversation is happening, who the contact is, rules to follow, etc. Add anything you need the bot to know which will help it automate your conversations and respond to your contacts">
                          <span className="cursor-help">Informações Adicionais ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.additional_info}
                        onChange={(e) => setAgent(prev => ({ ...prev, additional_info: e.target.value }))}
                        placeholder="Ex: Horário de funcionamento, políticas da empresa, informações de contato..."
                        rows={4}
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        System Prompt
                      </label>
                      <Textarea
                        value={agent.system_prompt}
                        onChange={(e) => setAgent(prev => ({ ...prev, system_prompt: e.target.value }))}
                        placeholder="Prompt do sistema para o agent..."
                        rows={4}
                        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'conhecimento' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Bases de Conhecimento</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-2">
                        Selecionar Bases de Conhecimento
                      </label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Escolha quais bases de conhecimento este agent deve utilizar para responder perguntas
                      </p>
                      <MultiSelect
                        options={knowledgeBases.map(kb => ({
                          id: kb.id,
                          name: kb.name,
                          description: kb.description,
                          type: kb.type
                        }))}
                        selectedIds={selectedKnowledgeBases}
                        onChange={setSelectedKnowledgeBases}
                        placeholder="Selecione as bases de conhecimento..."
                        className="w-full"
                      />
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {selectedKnowledgeBases.length} base(s) selecionada(s)
                    </div>

                    {knowledgeBases.length === 0 && (
                      <div className="bg-secondary rounded-lg p-6 border border-border text-center">
                        <div className="flex justify-center mb-4">
                          <div className="p-3 rounded-full bg-homio-purple-500/10 border border-homio-purple-500/20">
                            <BookOpen className="h-8 w-8 text-homio-purple-300" />
                          </div>
                        </div>
                        <h4 className="text-lg font-semibold text-foreground mb-2">
                          Nenhuma Base de Conhecimento Disponível
                        </h4>
                        <p className="text-muted-foreground mb-4">
                          Crie bases de conhecimento para esta location primeiro
                        </p>
                        <Button
                          variant="outline"
                          className="border-homio-purple-500/20 text-homio-purple-300 bg-homio-purple-500/10 hover:bg-homio-purple-500/20"
                        >
                          Gerenciar Bases de Conhecimento
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
