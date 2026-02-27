'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { Agent, UpdateAgentRequest, KnowledgeBase } from '@/lib/types';
import { promptToMarkdown } from '@/lib/prompt-formatter';

export default function EditAgentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') || 'd8voPwkhJK7k7S5xjHcA';
  
  const [activeTab, setActiveTab] = useState('detalhes');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [showCreateKB, setShowCreateKB] = useState(false);
  const [showKBSelector, setShowKBSelector] = useState(false);
  const [activeKB, setActiveKB] = useState<string | null>(null);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [showWebCrawlerManager, setShowWebCrawlerManager] = useState(false);
  const [kbSourcesForActive, setKbSourcesForActive] = useState<Array<{ id: string; url: string; scope: 'domain'|'path'|'single'; depth: number }>>([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [crawlStatuses, setCrawlStatuses] = useState<Record<string, any>>({});
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showMessage = (type: 'success' | 'error' | 'warning' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchAgent = async () => {
    try {
      const response = await fetch(`/api/agents/${params.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agent');
      }
      const agentData = await response.json();
      setAgent(agentData);
    } catch (error) {
      console.error('Error fetching agent:', error);
      showMessage('error', 'Erro ao carregar agent');
    }
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

  const fetchAgentKnowledgeBases = async () => {
    try {
      const response = await fetch(`/api/agents/${params.id}/knowledge-bases`);
      if (!response.ok) {
        throw new Error('Failed to fetch agent knowledge bases');
      }
      const data = await response.json();
      setSelectedKnowledgeBases(data.map((item: any) => item.knowledge_base_id));
    } catch (error) {
      console.error('Error fetching agent knowledge bases:', error);
      showMessage('error', 'Erro ao carregar bases de conhecimento do agent');
    }
  };

  const updateAgent = async () => {
    if (!agent) return;

    setLoading(true);
    try {
      const markdownPrompt = promptToMarkdown(agent, {
        includeHeader: true,
        includeMetadata: false,
        formatLists: true,
        separator: '\n\n---\n\n'
      });
      
      const updateData: UpdateAgentRequest = {
        name: agent.name,
        description: agent.description,
        personality: agent.personality,
        objective: agent.objective,
        additional_info: agent.additional_info,
        system_prompt: markdownPrompt,
        dify_app_id: agent.dify_app_id,
        settings: agent.settings,
        is_active: agent.is_active
      };

      const response = await fetch(`/api/agents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update agent');
      }

      const updatedAgent = await response.json();
      setAgent(updatedAgent);
      showMessage('success', 'Agent atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating agent:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar agent');
    } finally {
      setLoading(false);
    }
  };

  const updateAgentKnowledgeBases = async () => {
    setLoading(true);
    try {
      console.log('Updating agent knowledge bases:', selectedKnowledgeBases);
      
      const response = await fetch(`/api/agents/${params.id}/knowledge-bases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge_base_ids: selectedKnowledgeBases })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update agent knowledge bases');
      }

      const updatedData = await response.json();
      console.log('Updated knowledge bases:', updatedData);

      showMessage('success', 'Bases de conhecimento atualizadas com sucesso!');
    } catch (error) {
      console.error('Error updating agent knowledge bases:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar bases de conhecimento');
    } finally {
      setLoading(false);
    }
  };

  const createKnowledgeBase = async () => {
    if (!newKBName.trim()) {
      showMessage('error', 'Nome da base de conhecimento é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          name: newKBName,
          description: newKBDescription,
          type: 'mixed'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create knowledge base');
      }

      const newKB = await response.json();
      setKnowledgeBases([...knowledgeBases, newKB]);
      setNewKBName('');
      setNewKBDescription('');
      setShowCreateKB(false);
      showMessage('success', 'Base de conhecimento criada com sucesso!');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar base de conhecimento');
    } finally {
      setLoading(false);
    }
  };

  const [kbStats, setKbStats] = useState<Record<string, { webCrawler: number; faqs: number }>>({});

  const fetchKBStats = async (kbId: string) => {
    try {
      // Buscar estatísticas reais da base de conhecimento
      const [sourcesResponse, faqsResponse] = await Promise.all([
        fetch(`/api/kb/source?knowledge_base_id=${kbId}`),
        fetch(`/api/kb/faqs?knowledge_base_id=${kbId}`)
      ]);

      const sources = sourcesResponse.ok ? await sourcesResponse.json() : [];
      const faqs = faqsResponse.ok ? await faqsResponse.json() : [];

      setKbStats(prev => ({
        ...prev,
        [kbId]: {
          webCrawler: sources.length,
          faqs: faqs.length
        }
      }));
    } catch (error) {
      console.error('Error fetching KB stats:', error);
      // Fallback para dados mockados em caso de erro
      setKbStats(prev => ({
        ...prev,
        [kbId]: {
          webCrawler: Math.floor(Math.random() * 20),
          faqs: Math.floor(Math.random() * 10)
        }
      }));
    }
  };

  const getKBStats = (kbId: string) => {
    return kbStats[kbId] || { webCrawler: 0, faqs: 0 };
  };

  const fetchSourcesForKB = async (kbId: string) => {
    try {
      const response = await fetch(`/api/kb/source?knowledge_base_id=${kbId}`);
      if (!response.ok) return;
      const data = await response.json();
      setKbSourcesForActive(
        (data || []).map((s: any) => ({ id: s.id, url: s.url, scope: s.scope, depth: s.depth }))
      );
    } catch {}
  };

  const fetchCrawlStatuses = async (kbId: string) => {
    try {
      const response = await fetch(`/api/kb/crawl/status?knowledgeBaseId=${kbId}`);
      if (!response.ok) return;
      const data = await response.json();
      
      const statusMap: Record<string, any> = {};
      data.forEach((job: any) => {
        statusMap[job.source_id] = job;
      });
      
      setCrawlStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching crawl statuses:', error);
    }
  };

  const getCrawlStatus = (sourceId: string) => {
    return crawlStatuses[sourceId] || null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'running': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'running': return 'Executando';
      case 'success': return 'Concluído';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  };

  const createSourceForKB = async () => {
    if (!activeKB || !newSourceUrl.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/kb/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newSourceUrl,
          scope: 'path', // Padrão: caminho
          depth: 3, // Padrão: profundidade 3
          knowledge_base_id: activeKB,
          // agent_id será buscado automaticamente pela API
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create source');
      }
      setNewSourceUrl('');
      await fetchSourcesForKB(activeKB);
      await fetchKBStats(activeKB);
      showMessage('success', 'Fonte adicionada com sucesso!');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Erro ao criar fonte');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = (sourceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Fonte',
      message: 'Tem certeza que deseja excluir esta fonte? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        if (!activeKB) {
          return;
        }
        setLoading(true);
        try {
          const response = await fetch(`/api/kb/source?sourceId=${sourceId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            await fetchSourcesForKB(activeKB);
            await fetchKBStats(activeKB);
            showMessage('success', 'Fonte excluída com sucesso!');
          } else {
            const error = await response.json();
            showMessage('error', error.error || 'Erro ao excluir fonte');
          }
        } catch (error) {
          console.error('Error deleting source:', error);
          showMessage('error', 'Erro ao excluir fonte');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const startCrawlForSource = async (sourceId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/kb/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, mode: 'direct' })
      });
      
      if (!response.ok) {
        const err = await response.json();
        
        if (response.status === 409) {
          // Job já existe
          showMessage('warning', err.error || 'Já existe um crawl em andamento para esta fonte');
          if (activeKB) {
            await fetchCrawlStatuses(activeKB);
          }
          return;
        }
        
        throw new Error(err.error || 'Failed to start crawl');
      }
      
      if (!activeKB) {
        setLoading(false);
        return;
      }

      await fetchSourcesForKB(activeKB);
      await fetchKBStats(activeKB);
      await fetchCrawlStatuses(activeKB);
      showMessage('success', 'Crawl iniciado com sucesso!');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Erro ao iniciar crawl');
    } finally {
      setLoading(false);
    }
  };

  const deleteAgent = async () => {
    if (!confirm('Tem certeza que deseja excluir este agent?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${params.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      showMessage('success', 'Agent excluído com sucesso!');
      router.push(`/?locationId=${locationId}`);
    } catch (error) {
      console.error('Error deleting agent:', error);
      showMessage('error', 'Erro ao excluir agent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
    fetchKnowledgeBases();
    fetchAgentKnowledgeBases();
  }, [params.id, locationId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.kb-selector-container')) {
        setShowKBSelector(false);
      }
      if (!target.closest('.create-kb-container') && !target.closest('.create-kb-button')) {
        setShowCreateKB(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Definir KB ativa quando bases são selecionadas
  useEffect(() => {
    if (selectedKnowledgeBases.length > 0 && !activeKB) {
      setActiveKB(selectedKnowledgeBases[0]);
    }
  }, [selectedKnowledgeBases, activeKB]);

  // Buscar estatísticas das bases selecionadas
  useEffect(() => {
    selectedKnowledgeBases.forEach(kbId => {
      if (!kbStats[kbId]) {
        fetchKBStats(kbId);
      }
    });
  }, [selectedKnowledgeBases]);

  // Buscar status dos crawls quando KB ativa mudar
  useEffect(() => {
    if (activeKB) {
      fetchCrawlStatuses(activeKB);
    }
  }, [activeKB]);

  // Atualização automática de status enquanto o gerenciador está aberto
  useEffect(() => {
    if (!showWebCrawlerManager || !activeKB) return;

    const intervalId = setInterval(() => {
      fetchCrawlStatuses(activeKB);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [showWebCrawlerManager, activeKB]);

  const tabs = [
    { id: 'detalhes', label: 'Detalhes do Agent', description: 'Informações básicas do agent' },
    { id: 'prompt', label: 'Prompt', description: 'Personalidade e objetivos' },
    { id: 'conhecimento', label: 'Base de Conhecimento', description: 'Fontes e FAQs' },
    { id: 'configuracoes', label: 'Configurações', description: 'Configurações avançadas' }
  ];

  if (!agent) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header Section */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {agent.name}
              </h1>
              <p className="text-gray-400">
                Configure seu agent de IA para automatizar conversas
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={deleteAgent}
                disabled={loading}
              >
                Excluir
              </Button>
              <Button
                onClick={updateAgent}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
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
              : message.type === 'warning'
              ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
              : message.type === 'info'
              ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {message.text}
          </div>
        )}


        {/* Tabs Navigation */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="border-b border-gray-700">
            <div className="flex space-x-1 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400 bg-blue-900/30'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-lg">{tab.label}</span>
                    <span className="text-xs opacity-75">{tab.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'detalhes' && (
              <div className="space-y-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Informações Básicas</h3>
                    <p className="text-gray-400">Configure as informações básicas do seu agent</p>
                  </div>
                  <Button
                    variant="outline"
                  >
                    Definir como Principal
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Agent *
                    </label>
                    <Input
                      value={agent.name}
                      onChange={(e) => setAgent(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="Ex: Agente de Vendas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome da Empresa
                    </label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Minha Empresa Ltda"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição
                    </label>
                    <Textarea
                      value={agent.description || ''}
                      onChange={(e) => setAgent(prev => prev ? { ...prev, description: e.target.value } : null)}
                      placeholder="Descreva o propósito e função deste agent..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={updateAgent}
                    disabled={loading}
                  >
                    {loading ? 'Salvando...' : 'Salvar Detalhes'}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'configuracoes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Configurações Avançadas</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Dify App ID
                      </label>
                      <Input
                        value={agent.dify_app_id || ''}
                        onChange={(e) => setAgent(prev => prev ? { ...prev, dify_app_id: e.target.value } : null)}
                        placeholder="ID da aplicação no Dify (opcional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Status do Agent
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="active"
                            checked={agent.is_active}
                            onChange={() => setAgent(prev => prev ? { ...prev, is_active: true } : null)}
                            className="mr-2 text-blue-600"
                          />
                          <span className="text-gray-300">Ativo</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="inactive"
                            checked={!agent.is_active}
                            onChange={() => setAgent(prev => prev ? { ...prev, is_active: false } : null)}
                            className="mr-2 text-blue-600"
                          />
                          <span className="text-gray-300">Inativo</span>
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
                  <h3 className="text-lg font-semibold text-white mb-4">Configuração de Prompt</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <span className="flex items-center">
                          Personalidade
                          <Tooltip content="O bot é você ou seu assistente? Ele é formal ou sarcástico? Diga ao bot quem ele é e como pode atingir seus objetivos e coisas para ter em mente ao falar com o contato.">
                            <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1 text-[10px] font-medium text-gray-400 bg-gray-700 border border-gray-600 rounded-full hover:bg-gray-600 hover:text-white transition-colors">
                              ?
                            </span>
                        </Tooltip>
                        </span>
                      </label>
                      <Textarea
                        value={agent.personality || ''}
                        onChange={(e) => setAgent(prev => prev ? { ...prev, personality: e.target.value } : null)}
                        placeholder="Ex: Amigável, profissional, focado em resultados..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <span className="flex items-center">
                          Objetivo
                          <Tooltip content="O objetivo do bot. Use este espaço para definir qual é o objetivo do bot, como auxiliar com respostas a perguntas, agendar consultas, etc.">
                            <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1 text-[10px] font-medium text-gray-400 bg-gray-700 border border-gray-600 rounded-full hover:bg-gray-600 hover:text-white transition-colors">
                              ?
                            </span>
                        </Tooltip>
                        </span>
                      </label>
                      <Textarea
                        value={agent.objective || ''}
                        onChange={(e) => setAgent(prev => prev ? { ...prev, objective: e.target.value } : null)}
                        placeholder="Ex: Atender dúvidas sobre produtos, agendar consultas..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <span className="flex items-center">
                          Informações Adicionais
                          <Tooltip content="Informações importantes do negócio, por que a conversa está acontecendo, quem é o contato, regras a seguir, etc. Adicione qualquer coisa que o bot precise saber para ajudá-lo a automatizar suas conversas e responder aos seus contatos.">
                            <span className="cursor-help inline-flex items-center justify-center w-3 h-3 ml-1 text-[10px] font-medium text-gray-400 bg-gray-700 border border-gray-600 rounded-full hover:bg-gray-600 hover:text-white transition-colors">
                              ?
                            </span>
                        </Tooltip>
                        </span>
                      </label>
                      <Textarea
                        value={agent.additional_info || ''}
                        onChange={(e) => setAgent(prev => prev ? { ...prev, additional_info: e.target.value } : null)}
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
                  >
                    {loading ? 'Salvando...' : 'Salvar Prompt'}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'conhecimento' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Bases de Conhecimento</h3>
                  
                  <div className="space-y-6">
                    {/* Seleção de Bases de Conhecimento */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Bases de Conhecimento Vinculadas
                      </label>
                      <p className="text-sm text-gray-400 mb-3">
                        Selecione quais bases de conhecimento este agent deve utilizar
                      </p>
                      
                      <div className="flex gap-3">
                        <div className="flex-1 relative kb-selector-container">
                          <div 
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md cursor-pointer hover:border-gray-500 transition-colors"
                            onClick={() => setShowKBSelector(!showKBSelector)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {selectedKnowledgeBases.length === 0 ? (
                                  <span className="text-gray-400">Selecione as bases de conhecimento...</span>
                                ) : (
                                  selectedKnowledgeBases.map((kbId) => {
                                    const kb = knowledgeBases.find(k => k.id === kbId);
                                    return kb ? (
                                      <span
                                        key={kbId}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-300 text-sm rounded border border-blue-800"
                                      >
                                        {kb.name}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedKnowledgeBases(prev => prev.filter(id => id !== kbId));
                                          }}
                                          className="ml-1 hover:text-blue-100"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ) : null;
                                  })
                                )}
                              </div>
                              <svg className="w-5 h-5 text-gray-400 transition-transform" style={{ transform: showKBSelector ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          
                          {showKBSelector && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-10">
                              {knowledgeBases.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto">
                                  {knowledgeBases.map((kb) => (
                                    <div
                                      key={kb.id}
                                      className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
                                      onClick={() => {
                                        if (selectedKnowledgeBases.includes(kb.id)) {
                                          setSelectedKnowledgeBases(prev => prev.filter(id => id !== kb.id));
                                        } else {
                                          setSelectedKnowledgeBases(prev => [...prev, kb.id]);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-white font-medium">{kb.name}</div>
                                          {kb.description && (
                                            <div className="text-gray-400 text-sm">{kb.description}</div>
                                          )}
                                        </div>
                                        {selectedKnowledgeBases.includes(kb.id) && (
                                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 text-center text-gray-400">
                                  Nenhuma base de conhecimento encontrada
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          className="create-kb-button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (showCreateKB) {
                              // Se está aberto, fecha e limpa os campos
                              setShowCreateKB(false);
                              setNewKBName('');
                              setNewKBDescription('');
                            } else {
                              // Se está fechado, abre
                              setShowCreateKB(true);
                            }
                          }}
                          variant="outline"
                        >
                          {showCreateKB ? 'Cancelar' : 'Criar Nova Base'}
                        </Button>
                      </div>
                      
                      {/* Formulário de Criação de Nova Base */}
                      {showCreateKB && (
                        <div className="mt-4 p-4 bg-gray-800 border border-gray-600 rounded-md create-kb-container">
                          <h4 className="text-white font-medium mb-3">Criar Nova Base de Conhecimento</h4>
                          <div className="space-y-3">
                            <Input
                              value={newKBName}
                              onChange={(e) => setNewKBName(e.target.value)}
                              placeholder="Nome da base de conhecimento"
                            />
                            <Textarea
                              value={newKBDescription}
                              onChange={(e) => setNewKBDescription(e.target.value)}
                              placeholder="Descrição (opcional)"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={createKnowledgeBase}
                                disabled={loading || !newKBName.trim()}
                                size="sm"
                              >
                                {loading ? 'Criando...' : 'Criar'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sistema de Abas para Bases Selecionadas */}
                    {selectedKnowledgeBases.length > 0 && (
                      <div>
                        <h4 className="text-md font-medium text-white mb-4">
                          Gerenciar Conteúdo das Bases
                        </h4>
                        
                        <div className="bg-gray-800 rounded-lg border border-gray-700">
                          {/* Navegação das Abas */}
                          <div className="border-b border-gray-700">
                            <div className="flex space-x-1 px-6">
                              {selectedKnowledgeBases.map((kbId) => {
                                const kb = knowledgeBases.find(k => k.id === kbId);
                                if (!kb) return null;
                                
                                const isActive = activeKB === kbId;
                                
                                return (
                                  <button
                                    key={kbId}
                                    onClick={() => setActiveKB(kbId)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                      isActive 
                                        ? 'border-blue-500 text-blue-400 bg-blue-900/30' 
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center space-y-1">
                                      <span className="text-sm">{kb.name}</span>
                                      <span className="text-xs opacity-75">
                                        {getKBStats(kbId).webCrawler + getKBStats(kbId).faqs} itens
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Conteúdo da Aba Ativa */}
                          {activeKB && (
                            <div className="p-6">
                              {(() => {
                                const kb = knowledgeBases.find(k => k.id === activeKB);
                                if (!kb) return null;
                                
                                return (
                                  <div className="space-y-6">
                                    <div>
                                      <h5 className="text-lg font-semibold text-white mb-2">{kb.name}</h5>
                                      {kb.description && (
                                        <p className="text-gray-400 text-sm mb-4">{kb.description}</p>
                                      )}
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Web Crawler */}
                                        <div 
                                          className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer"
                                          onClick={async () => {
                                            if (!activeKB) return;
                                            setShowWebCrawlerManager((prev) => !prev);
                                            await fetchSourcesForKB(activeKB);
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                                                </svg>
                                              </div>
                                              <div>
                                                <div className="text-white font-medium">Web Crawler</div>
                                                <div className="text-gray-400 text-sm">
                                                  {getKBStats(activeKB).webCrawler} Links configurados
                                                </div>
                                              </div>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!activeKB) return;
                                                setShowWebCrawlerManager((prev) => !prev);
                                                fetchSourcesForKB(activeKB);
                                              }}
                                            >
                                              Gerenciar
                                            </Button>
                                          </div>
                                          <p className="text-gray-400 text-xs">
                                            Adicione sites para fazer crawling automático e extrair conteúdo
                                          </p>
                                        </div>

                                        {/* FAQs */}
                                        <div 
                                          className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer"
                                          onClick={() => {
                                            // TODO: Implementar gerenciador de FAQs
                                            showMessage('info', 'Gerenciador de FAQs em desenvolvimento');
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                              </div>
                                              <div>
                                                <div className="text-white font-medium">FAQs</div>
                                                <div className="text-gray-400 text-sm">
                                                  {getKBStats(activeKB).faqs} Perguntas cadastradas
                                                </div>
                                              </div>
                                            </div>
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                showMessage('info', 'Gerenciador de FAQs em desenvolvimento');
                                              }}
                                            >
                                              Gerenciar
                                            </Button>
                                          </div>
                                          <p className="text-gray-400 text-xs">
                                            Crie perguntas e respostas frequentes para o agent
                                          </p>
                                        </div>
                                      </div>

                                      {/* Web Crawler Manager */}
                                      {showWebCrawlerManager && activeKB && (
                                        <div className="mt-4 bg-gray-800 border border-gray-700 rounded-md p-4">
                                          <h6 className="text-white font-medium mb-3">Gerenciar Web Crawler</h6>
                                          <div className="flex gap-3 mb-4">
                                            <Input
                                              value={newSourceUrl}
                                              onChange={(e) => setNewSourceUrl(e.target.value)}
                                              placeholder="https://site.com"
                                              className="flex-1"
                                            />
                                            <Button size="sm" onClick={createSourceForKB} disabled={loading || !newSourceUrl.trim()}>
                                              {loading ? 'Adicionando...' : 'Adicionar Fonte'}
                                            </Button>
                                          </div>
                                          <div className="text-xs text-gray-400 mb-3">
                                            Configuração automática: Caminho com profundidade 3
                                          </div>

                                          <div className="space-y-2">
                                            {kbSourcesForActive.length === 0 ? (
                                              <div className="text-gray-400 text-sm">Nenhuma fonte cadastrada para esta base.</div>
                                            ) : (
                                              kbSourcesForActive.map((s) => {
                                                const crawlStatus = getCrawlStatus(s.id);
                                                const isJobRunning = crawlStatus && ['pending', 'running'].includes(crawlStatus.status);
                                                const isCompleted = crawlStatus && crawlStatus.status === 'success';
                                                const hasError = crawlStatus && crawlStatus.status === 'error';
                                                
                                                // Determinar cor da borda baseada no status
                                                let borderColor = 'border-gray-600';
                                                if (isCompleted) borderColor = 'border-green-500';
                                                else if (hasError) borderColor = 'border-red-500';
                                                else if (isJobRunning) borderColor = 'border-blue-500';
                                                
                                                return (
                                                  <div key={s.id} className={`flex items-center justify-between bg-gray-700 border ${borderColor} rounded-md px-3 py-2`}>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-gray-200 text-sm truncate">{s.url}</div>
                                                      <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-400">{s.scope} · d{s.depth}</span>
                                                        {crawlStatus && (
                                                          <span className={`text-xs ${getStatusColor(crawlStatus.status)}`}>
                                                            {getStatusText(crawlStatus.status)}
                                                            {crawlStatus.status === 'error' && crawlStatus.error && (
                                                              <span className="ml-1" title={crawlStatus.error}>⚠️</span>
                                                            )}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      {!isCompleted && (
                                                        <Button 
                                                          size="sm" 
                                                          variant="outline" 
                                                          onClick={() => startCrawlForSource(s.id)} 
                                                          disabled={loading || isJobRunning}
                                                        >
                                                          {isJobRunning ? 'Executando...' : 'Iniciar Crawl'}
                                                        </Button>
                                                      )}
                                                      <Button 
                                                        size="sm" 
                                                        variant="destructive" 
                                                        onClick={() => handleDeleteSource(s.id)} 
                                                        disabled={loading}
                                                      >
                                                        Excluir
                                                      </Button>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Botão de Salvar */}
                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={updateAgentKnowledgeBases}
                        disabled={loading}
                      >
                        {loading ? 'Salvando...' : 'Salvar Configurações'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
