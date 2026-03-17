'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, Plus, AlertTriangle, Loader2 } from 'lucide-react';
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
import { getGHLUserData, type GHLUserData } from '@/lib/ghl-user-data';

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

  const [locationId, setLocationId] = useState<string>(searchParams.get('locationId') || '');
  const [ghlUser, setGhlUser] = useState<GHLUserData | null>(null);
  const [ghlLoading, setGhlLoading] = useState(true);
  const [ghlError, setGhlError] = useState<string | null>(null);
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
                'Crawl Concluido com Sucesso',
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
                'Erro no Crawl',
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

  // Detect GHL location on mount
  useEffect(() => {
    // If locationId already set via URL param, skip GHL detection
    if (locationId) {
      setGhlLoading(false);
      return;
    }

    const detectGHLLocation = async () => {
      try {
        setGhlLoading(true);
        const userData = await getGHLUserData();
        setGhlUser(userData);
        if (userData.activeLocation) {
          setLocationId(userData.activeLocation);
        } else {
          setGhlError('No activeLocation found in GHL user data');
        }
      } catch (error) {
        console.warn('GHL detection failed (may not be in iframe):', error);
        setGhlError(
          error instanceof Error ? error.message : 'Failed to detect GHL location'
        );
      } finally {
        setGhlLoading(false);
      }
    };

    detectGHLLocation();
  }, []);

  // Load data when locationId is available
  useEffect(() => {
    if (locationId) {
      fetchLocation();
      fetchFaqs();
      fetchSources();
      fetchActiveJobs();
      fetchAgents();
    }
  }, [locationId]);

  // Show loading while detecting GHL location
  if (ghlLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-homio-purple-500/10 border border-homio-purple-500/20 flex items-center justify-center animate-pulse-glow">
            <Loader2 className="w-8 h-8 text-homio-purple-400 animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium">Detectando location...</p>
        </div>
      </div>
    );
  }

  // Show error if no location detected
  if (!locationId) {
    return (
      <div className="min-h-screen bg-background text-foreground dark flex items-center justify-center">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Location nao detectada</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            {ghlError || 'Nao foi possivel identificar a location. Certifique-se de que a pagina esta incorporada no GHL.'}
          </p>
          <p className="text-muted-foreground/50 text-sm">
            Para teste, adicione <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground/70 text-xs">?locationId=SEU_ID</code> na URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header/Hero Section */}
      <HeroSection
        onCreateAgent={() => setActiveTab('agents')}
        agentsCount={agents.length}
        locationName={location?.name || ghlUser?.userName || 'Carregando...'}
        locationId={locationId}
      />

      {/* Main Content - Agents Section */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium animate-slide-up ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}

        <div className="mb-12">
          <div className="flex justify-between items-center mb-8 animate-slide-up">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Meus Agents
              </h2>
              <p className="text-muted-foreground text-sm">
                Gerencie e configure seus agentes de IA
              </p>
            </div>
            <button
              onClick={() => window.location.href = `/agents/new?locationId=${locationId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl
                bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 text-white
                hover:from-homio-purple-500 hover:to-homio-purple-400
                shadow-lg shadow-homio-purple-500/20 hover:shadow-homio-purple-500/30
                transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Criar Agent
            </button>
          </div>

          {loading && agents.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Loader2 className="w-8 h-8 text-homio-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Carregando agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <EmptyAgentsState onCreateAgent={() => window.location.href = `/agents/new?locationId=${locationId}`} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent, index) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={index}
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
                          showMessage('error', 'Nao e possivel excluir este agent pois ele possui fontes de conhecimento ou FAQs associados.');
                        } else {
                          throw new Error(errorData.error || 'Failed to delete agent');
                        }
                        return;
                      }

                      setAgents(prev => prev.filter(a => a.id !== agentId));
                      if (selectedAgentId === agentId) {
                        setSelectedAgentId('');
                      }
                      showMessage('success', 'Agent excluido com sucesso!');
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