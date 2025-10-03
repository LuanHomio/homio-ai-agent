'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Navigation } from '@/components/Navigation';
import { SourcesList } from '@/components/SourcesList';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

interface KBSource {
  id: string;
  url: string;
  scope: 'domain' | 'path' | 'single';
  depth: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

interface CrawlJob {
  id: string;
  source_id: string;
  status: 'pending' | 'running' | 'success' | 'error';
  started_at?: string;
  finished_at?: string;
  error?: string;
  meta?: any;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState('sources');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [sources, setSources] = useState<KBSource[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [newSource, setNewSource] = useState({ url: '', scope: 'single' as const, depth: 2 });
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [crawlMode, setCrawlMode] = useState<'direct' | 'n8n'>('direct');
  const [activeJobs, setActiveJobs] = useState<CrawlJob[]>([]);
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);
  const [crawlResultModal, setCrawlResultModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
    details?: any;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const showCrawlResultModal = (type: 'success' | 'error', title: string, message: string, details?: any) => {
    setCrawlResultModal({
      isOpen: true,
      title,
      message,
      type,
      details
    });
  };

  const closeCrawlResultModal = () => {
    setCrawlResultModal(prev => ({ ...prev, isOpen: false }));
  };

  // Fetch FAQs from API
  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/kb/faqs');
      if (!response.ok) {
        throw new Error('Failed to fetch FAQs');
      }
      const data = await response.json();
      setFaqs(data);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      showMessage('error', 'Erro ao carregar FAQs');
    } finally {
      setLoading(false);
    }
  };

  // Create new FAQ
  const createFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) {
      showMessage('error', 'Pergunta e resposta são obrigatórias');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/kb/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newFaq),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create FAQ');
      }

      const createdFaq = await response.json();
      setFaqs([createdFaq, ...faqs]);
      setNewFaq({ question: '', answer: '' });
      showMessage('success', 'FAQ criada com sucesso!');
    } catch (error) {
      console.error('Error creating FAQ:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar FAQ');
    } finally {
      setLoading(false);
    }
  };

  // Update FAQ
  const updateFaq = async () => {
    if (!editingFaq || !editingFaq.question.trim() || !editingFaq.answer.trim()) {
      showMessage('error', 'Pergunta e resposta são obrigatórias');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/kb/faqs/${editingFaq.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: editingFaq.question,
          answer: editingFaq.answer,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update FAQ');
      }

      const updatedFaq = await response.json();
      setFaqs(faqs.map(faq => faq.id === editingFaq.id ? updatedFaq : faq));
      setEditingFaq(null);
      showMessage('success', 'FAQ atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating FAQ:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar FAQ');
    } finally {
      setLoading(false);
    }
  };

  // Delete FAQ
  const deleteFaq = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta FAQ?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/kb/faqs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete FAQ');
      }

      setFaqs(faqs.filter(faq => faq.id !== id));
      showMessage('success', 'FAQ excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao excluir FAQ');
    } finally {
      setLoading(false);
    }
  };

  // Fetch sources from API
  const fetchSources = async () => {
    try {
      const response = await fetch('/api/kb/source');
      if (!response.ok) {
        throw new Error('Failed to fetch sources');
      }
      const data = await response.json();
      setSources(data);
    } catch (error) {
      console.error('Error fetching sources:', error);
      showMessage('error', 'Erro ao carregar fontes');
    }
  };

  // Create new source
  const createSource = async () => {
    if (!newSource.url.trim()) {
      showMessage('error', 'URL é obrigatória');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/kb/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSource),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create source');
      }

      const createdSource = await response.json();
      setSources([createdSource, ...sources]);
      setNewSource({ url: '', scope: 'single', depth: 2 });
      showMessage('success', 'Fonte criada com sucesso!');
    } catch (error) {
      console.error('Error creating source:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar fonte');
    } finally {
      setLoading(false);
    }
  };

  // Start crawl
  const startCrawl = async () => {
    if (!selectedSource) {
      showMessage('error', 'Selecione uma fonte para fazer o crawl');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/kb/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceId: selectedSource,
          mode: crawlMode
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start crawl');
      }

      const result = await response.json();
      showMessage('success', `Crawl iniciado! Aguarde o processamento...`);
      
      // Add job to active jobs list immediately
      const newJob: CrawlJob = {
        id: result.jobId,
        source_id: selectedSource,
        status: 'pending',
        created_at: new Date().toISOString(),
        meta: { mode: crawlMode }
      };
      setActiveJobs(prev => [newJob, ...prev]);
      
      // Start polling for job status
      pollJobStatus(result.jobId);
    } catch (error) {
      console.error('Error starting crawl:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao iniciar crawl');
    } finally {
      setLoading(false);
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/kb/jobs/${jobId}`);
        if (response.ok) {
          const job = await response.json();
          
          // Update active jobs list
          setActiveJobs(prev => {
            const filtered = prev.filter(j => j.id !== jobId);
            if (job.status === 'running' || job.status === 'pending') {
              return [...filtered, job];
            }
            return filtered;
          });

          if (job.status === 'success' || job.status === 'error') {
            const source = sources.find(s => s.id === job.source_id);
            
            if (job.status === 'success') {
              showCrawlResultModal(
                'success',
                '🎉 Crawl Concluído com Sucesso!',
                `O crawl da fonte foi finalizado com sucesso!`,
                {
                  sourceUrl: source?.url,
                  pagesProcessed: job.meta?.pagesProcessed || 0,
                  mode: job.meta?.mode,
                  duration: job.started_at && job.finished_at 
                    ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                    : null,
                  fallbackUsed: job.meta?.fallbackUsed,
                  originalError: job.meta?.originalError
                }
              );
            } else {
              showCrawlResultModal(
                'error',
                '❌ Erro no Crawl',
                `Ocorreu um erro durante o processo de crawl.`,
                {
                  sourceUrl: source?.url,
                  error: job.error,
                  mode: job.meta?.mode
                }
              );
            }
            return;
          }
          // Continue polling if still running
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };
    poll();
  };

  // Fetch active jobs
  const fetchActiveJobs = async () => {
    try {
      const response = await fetch('/api/kb/jobs?status=running,pending');
      if (response.ok) {
        const jobs = await response.json();
        setActiveJobs(jobs);
      }
    } catch (error) {
      console.error('Error fetching active jobs:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchFaqs();
    fetchSources();
    fetchActiveJobs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Knowledge Base Admin
          </h1>
          <p className="text-lg text-gray-600">
            Gerencie fontes, execute crawls e mantenha FAQs
          </p>
        </div>

        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {message && (
          <div className={`p-4 rounded-md mb-6 ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'sources' && (
          <SourcesList
            onSourceSelect={setSelectedSource}
            selectedSourceId={selectedSource}
            onNewSource={() => setShowNewSourceForm(true)}
          />
        )}

        {activeTab === 'crawler' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Web Crawler</h2>
              <p className="text-gray-600">Execute crawls e monitore o progresso</p>
            </div>

            {/* Sources List for Selection */}
            <SourcesList
              onSourceSelect={setSelectedSource}
              selectedSourceId={selectedSource}
              showFilters={true}
            />

            {/* Crawler Controls */}
            {selectedSource && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🕷️ Executar Crawl
                  </CardTitle>
                  <CardDescription>
                    Configure e execute o crawl da fonte selecionada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modo de Crawl
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="mode"
                          value="direct"
                          checked={crawlMode === 'direct'}
                          onChange={(e) => setCrawlMode(e.target.value as 'direct' | 'n8n')}
                          className="mr-2"
                        />
                        Direct (Firecrawl)
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="mode"
                          value="n8n"
                          checked={crawlMode === 'n8n'}
                          onChange={(e) => setCrawlMode(e.target.value as 'direct' | 'n8n')}
                          className="mr-2"
                        />
                        n8n Webhook
                      </label>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Fonte selecionada:</strong> {sources.find(s => s.id === selectedSource)?.url}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Modo:</strong> {crawlMode === 'direct' ? 'Firecrawl Direto' : 'n8n Webhook'}
                    </p>
                  </div>

                  <Button
                    onClick={startCrawl}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Iniciando Crawl...' : 'Executar Crawl'}
                  </Button>

                  {/* Test Buttons */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">Testes</h4>
                        <p className="text-sm text-gray-600">Teste a conectividade antes de executar</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const source = sources.find(s => s.id === selectedSource);
                            
                            if (!source) {
                              throw new Error('Fonte não encontrada');
                            }

                            const response = await fetch('/api/test/firecrawl', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: source.url }),
                            });

                            const result = await response.json();

                            if (result.success) {
                              showMessage('success', `Firecrawl funcionando! Página testada: ${result.data?.title || 'Sem título'} (${result.data?.contentLength} caracteres)`);
                            } else {
                              showMessage('error', `Erro no Firecrawl: ${result.error}`);
                            }
                          } catch (error) {
                            console.error('Error testing Firecrawl:', error);
                            showMessage('error', error instanceof Error ? error.message : 'Erro ao testar Firecrawl');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                      >
                        {loading ? 'Testando...' : 'Teste Simples'}
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const source = sources.find(s => s.id === selectedSource);
                            
                            if (!source) {
                              throw new Error('Fonte não encontrada');
                            }

                            const response = await fetch('/api/test/fallback-simulation', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: source.url }),
                            });

                            const result = await response.json();

                            if (result.success) {
                              showMessage('success', `Simulação de fallback concluída! Verifique o console para detalhes.`);
                              console.log('🔍 Resultado da simulação de fallback:', result);
                            } else {
                              showMessage('error', `Erro na simulação: ${result.error}`);
                              console.log('❌ Detalhes do erro:', result);
                            }
                          } catch (error) {
                            console.error('Error in fallback simulation:', error);
                            showMessage('error', error instanceof Error ? error.message : 'Erro na simulação');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        disabled={loading}
                      >
                        {loading ? 'Testando...' : 'Teste Fallback'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Jobs Status */}
            {activeJobs.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        ⚡ Crawls Ativos
                      </CardTitle>
                      <CardDescription>
                        Acompanhe o progresso dos crawls em execução
                      </CardDescription>
                    </div>
                    <Button
                      onClick={fetchActiveJobs}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      {loading ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeJobs.map((job) => {
                      const source = sources.find(s => s.id === job.source_id);
                      return (
                        <div key={job.id} className="p-4 bg-blue-50 rounded border border-blue-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-blue-900">
                                {source?.url || 'Fonte desconhecida'}
                              </p>
                              <p className="text-sm text-blue-700">
                                Modo: {job.meta?.mode || 'unknown'} •
                                Status: {job.status === 'pending' ? 'Aguardando' :
                                        job.status === 'running' ? 'Executando' : job.status}
                              </p>
                              {job.started_at && (
                                <p className="text-xs text-blue-600">
                                  Iniciado: {new Date(job.started_at).toLocaleTimeString('pt-BR')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center">
                              {job.status === 'pending' && (
                                <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
                              )}
                              {job.status === 'running' && (
                                <div className="w-4 h-4 bg-blue-500 rounded-full animate-spin"></div>
                              )}
                            </div>
                          </div>
                          {job.error && (
                            <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                              <strong>Erro:</strong> {job.error}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">FAQs</h2>
              <p className="text-gray-600">Gerencie perguntas e respostas frequentes</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ❓ Gerenciar FAQs
                </CardTitle>
                <CardDescription>
                  Adicione, edite e remova perguntas e respostas frequentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingFaq ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pergunta
                      </label>
                      <Input
                        placeholder="Qual é a pergunta?"
                        value={editingFaq.question}
                        onChange={(e) => setEditingFaq({...editingFaq, question: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Resposta
                      </label>
                      <Textarea
                        placeholder="Qual é a resposta?"
                        rows={4}
                        value={editingFaq.answer}
                        onChange={(e) => setEditingFaq({...editingFaq, answer: e.target.value})}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={updateFaq}
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                      <Button
                        onClick={() => setEditingFaq(null)}
                        variant="outline"
                        disabled={loading}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pergunta
                      </label>
                      <Input
                        placeholder="Qual é a pergunta?"
                        value={newFaq.question}
                        onChange={(e) => setNewFaq({...newFaq, question: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Resposta
                      </label>
                      <Textarea
                        placeholder="Qual é a resposta?"
                        rows={4}
                        value={newFaq.answer}
                        onChange={(e) => setNewFaq({...newFaq, answer: e.target.value})}
                      />
                    </div>

                    <Button
                      onClick={createFaq}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Criando...' : 'Adicionar FAQ'}
                    </Button>
                  </>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">FAQs Existentes</h3>
                    <Button
                      onClick={fetchFaqs}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      {loading ? 'Carregando...' : 'Atualizar'}
                    </Button>
                  </div>

                  {loading && faqs.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      Carregando FAQs...
                    </div>
                  ) : faqs.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      Nenhuma FAQ encontrada. Adicione a primeira!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {faqs.map((faq) => (
                        <div key={faq.id} className="p-4 bg-gray-50 rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900">{faq.question}</h4>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => setEditingFaq(faq)}
                                variant="outline"
                                size="sm"
                                disabled={loading}
                              >
                                Editar
                              </Button>
                              <Button
                                onClick={() => deleteFaq(faq.id)}
                                variant="destructive"
                                size="sm"
                                disabled={loading}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Criado em: {new Date(faq.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* New Source Modal */}
        <Modal
          isOpen={showNewSourceForm}
          onClose={() => setShowNewSourceForm(false)}
          title="🌐 Nova Fonte"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <Input
                placeholder="https://example.com"
                type="url"
                value={newSource.url}
                onChange={(e) => setNewSource({...newSource, url: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escopo
              </label>
              <Select
                value={newSource.scope}
                onChange={(e) => setNewSource({...newSource, scope: e.target.value as 'domain' | 'path' | 'single'})}
              >
                <option value="single">Página única</option>
                <option value="path">Caminho</option>
                <option value="domain">Domínio completo</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profundidade
              </label>
              <Input
                type="number"
                min="1"
                max="5"
                value={newSource.depth}
                onChange={(e) => setNewSource({...newSource, depth: parseInt(e.target.value) || 1})}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await createSource();
                  setShowNewSourceForm(false);
                }}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Criando...' : 'Salvar Fonte'}
              </Button>
              <Button
                onClick={() => setShowNewSourceForm(false)}
                variant="outline"
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>


        {/* Crawl Result Modal */}
        <Modal
          isOpen={crawlResultModal.isOpen}
          onClose={closeCrawlResultModal}
          title={crawlResultModal.title}
        >
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${
              crawlResultModal.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`${
                crawlResultModal.type === 'success' 
                  ? 'text-green-800' 
                  : 'text-red-800'
              }`}>
                {crawlResultModal.message}
              </p>
            </div>

            {crawlResultModal.details && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Detalhes do Crawl:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">URL:</span>
                    <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                      {crawlResultModal.details?.sourceUrl}
                    </span>
                  </div>
                  
                  {crawlResultModal.details?.pagesProcessed !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Páginas processadas:</span>
                      <span className="font-medium">{crawlResultModal.details.pagesProcessed}</span>
                    </div>
                  )}
                  
                  {crawlResultModal.details?.mode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Modo:</span>
                      <span className="font-medium">
                        {crawlResultModal.details.mode === 'direct' ? 'Firecrawl Direto' : 'n8n Webhook'}
                      </span>
                    </div>
                  )}
                  
                  {crawlResultModal.details?.duration && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duração:</span>
                      <span className="font-medium">{crawlResultModal.details.duration}s</span>
                    </div>
                  )}
                  
                  {crawlResultModal.details?.fallbackUsed && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Método:</span>
                      <span className="font-medium text-yellow-600">Fallback (Scrape)</span>
                    </div>
                  )}
                  
                  {crawlResultModal.details?.error && (
                    <div className="mt-3 p-3 bg-red-100 rounded border border-red-200">
                      <p className="text-sm text-red-800">
                        <strong>Erro:</strong> {crawlResultModal.details.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {crawlResultModal.type === 'success' && (
              <div className="space-y-3">
                {crawlResultModal.details?.fallbackUsed && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ <strong>Fallback usado:</strong> O crawl inicial falhou, mas conseguimos 
                      extrair o conteúdo usando scrape da página principal. 
                      {crawlResultModal.details?.originalError && (
                        <> Erro original: {crawlResultModal.details.originalError}</>
                      )}
                    </p>
                  </div>
                )}
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>Próximos passos:</strong> Os documentos foram salvos no banco de dados 
                    e divididos em chunks para futuras consultas via RAG. Você pode usar essas informações 
                    para treinar agentes de IA ou fazer buscas semânticas.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
}