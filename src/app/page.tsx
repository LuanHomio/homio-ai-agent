'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Navigation } from '@/components/Navigation';
import { SourcesList } from '@/components/SourcesList';
import { AgentsManager } from '@/components/AgentsManager';
import { HeroSection } from '@/components/HeroSection';
import { EmptyAgentsState } from '@/components/EmptyAgentsState';
import { AgentCard } from '@/components/AgentCard';
import { Footer } from '@/components/Footer';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  slug: string;
  ghl_location_id?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  personality?: string;
  system_prompt?: string;
  dify_app_id?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: Location;
}

interface KBSource {
  id: string;
  url: string;
  scope: 'domain' | 'path' | 'single';
  depth: number;
  agent_id: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

interface CrawlJob {
  id: string;
  source_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'success' | 'error';
  started_at?: string;
  finished_at?: string;
  error?: string;
  meta?: any;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') || 'd8voPwkhJK7k7S5xjHcA'; // Default para testes
  
  const [activeTab, setActiveTab] = useState('agents');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [sources, setSources] = useState<KBSource[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', agent_id: '' });
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [newSource, setNewSource] = useState({ url: '', scope: 'single' as const, depth: 2, agent_id: '' });
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [crawlMode, setCrawlMode] = useState<'direct' | 'n8n'>('direct');
  const [activeJobs, setActiveJobs] = useState<CrawlJob[]>([]);
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);
  
  // States for agent management
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
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

    if (!newFaq.agent_id) {
      showMessage('error', 'Selecione um agent para criar a FAQ');
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
      setNewFaq({ question: '', answer: '', agent_id: selectedAgentId || '' });
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

    if (!newSource.agent_id) {
      showMessage('error', 'Selecione um agent para criar a fonte');
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
      setNewSource({ url: '', scope: 'single', depth: 2, agent_id: selectedAgentId || '' });
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
        agent_id: selectedAgentId || '',
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

  const fetchLocation = async () => {
    try {
      const response = await fetch(`/api/locations/${locationId}`);
      if (!response.ok) throw new Error('Failed to fetch location');
      const data = await response.json();
      setLocation(data);
    } catch (error) {
      console.error('Error fetching location:', error);
      showMessage('error', 'Erro ao carregar location');
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await fetch(`/api/agents?location_id=${locationId}`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data);
      
      // Auto-select first agent if none selected
      if (!selectedAgentId && data.length > 0) {
        setSelectedAgentId(data[0].id);
        setNewFaq(prev => ({ ...prev, agent_id: data[0].id }));
        setNewSource(prev => ({ ...prev, agent_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      showMessage('error', 'Erro ao carregar agents');
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (locationId) {
      fetchLocation();
    fetchFaqs();
    fetchSources();
    fetchActiveJobs();
    fetchAgents();
    }
  }, [locationId]);

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header/Hero Section */}
      <HeroSection 
        onCreateAgent={() => setActiveTab('agents')}
        agentsCount={agents.length}
        locationName={location?.name || 'Carregando...'}
        locationId={locationId}
      />
      
      {/* Main Content - Agents Section */}
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

        <div className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                🤖 Meus Agents
              </h2>
              <p className="text-gray-400">
                Gerencie e configure seus agentes de IA
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = `/agents/new?locationId=${locationId}`}
              className="px-6 py-3"
            >
              Criar Agent
            </Button>
          </div>

          {loading && agents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              Carregando agents...
            </div>
          ) : agents.length === 0 ? (
            <EmptyAgentsState onCreateAgent={() => window.location.href = `/agents/new?locationId=${locationId}`} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgentId === agent.id}
                  showActions={true}
                  onSelect={(agentId) => {
              setSelectedAgentId(agentId);
              setNewFaq(prev => ({ ...prev, agent_id: agentId }));
              setNewSource(prev => ({ ...prev, agent_id: agentId }));
            }}
                  onEdit={(agent) => {
                    window.location.href = `/agents/${agent.id}?locationId=${locationId}`;
                  }}
                  onDelete={async (agentId) => {
                    if (!confirm('Tem certeza que deseja excluir este agent?')) return;
                    
                    try {
                      const response = await fetch(`/api/agents/${agentId}`, {
                        method: 'DELETE'
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        if (response.status === 409) {
                          showMessage('error', 'Não é possível excluir este agent pois ele possui fontes de conhecimento ou FAQs associados. Exclua primeiro todos os dados relacionados.');
                            } else {
                          throw new Error(errorData.error || 'Failed to delete agent');
                        }
                        return;
                      }

                      setAgents(prev => prev.filter(agent => agent.id !== agentId));
                      if (selectedAgentId === agentId) {
                        setSelectedAgentId('');
                      }
                      showMessage('success', 'Agent excluído com sucesso!');
                          } catch (error) {
                      console.error('Error deleting agent:', error);
                      showMessage('error', error instanceof Error ? error.message : 'Erro ao excluir agent');
                    }
                  }}
                />
                      ))}
                    </div>
                  )}
                </div>
              </div>

      {/* Footer Section */}
      <Footer />
    </div>
  );
}