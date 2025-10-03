'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SourceStatus } from '@/components/SourceStatus';

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

interface Document {
  id: string;
  source_id: string;
  url: string;
  title: string;
  created_at: string;
}

interface SourcesListProps {
  onSourceSelect: (sourceId: string) => void;
  selectedSourceId?: string;
  showFilters?: boolean;
  onNewSource?: () => void;
}

export function SourcesList({ onSourceSelect, selectedSourceId, showFilters = true, onNewSource }: SourcesListProps) {
  const [sources, setSources] = useState<KBSource[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'success' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch sources
  const fetchSources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/kb/source');
      if (!response.ok) throw new Error('Failed to fetch sources');
      const data = await response.json();
      setSources(data);
    } catch (error) {
      console.error('Error fetching sources:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/kb/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/kb/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchSources();
    fetchDocuments();
    fetchJobs();
  }, []);

  // Get source status data
  const getSourceStatus = (sourceId: string) => {
    const sourceDocuments = documents.filter(doc => doc.source_id === sourceId);
    const sourceJobs = jobs.filter(job => job.source_id === sourceId);
    const lastJob = sourceJobs.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    return { sourceDocuments, lastJob };
  };

  // Filter sources based on status and search
  const filteredSources = sources.filter(source => {
    const { sourceDocuments, lastJob } = getSourceStatus(source.id);
    
    // Search filter
    if (searchTerm && !source.url.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    switch (filter) {
      case 'pending':
        return !lastJob;
      case 'success':
        return lastJob?.status === 'success' && sourceDocuments.length > 0;
      case 'error':
        return lastJob?.status === 'error';
      default:
        return true;
    }
  });

  // Sort sources: pending first, then by creation date
  const sortedSources = filteredSources.sort((a, b) => {
    const aStatus = getSourceStatus(a.id);
    const bStatus = getSourceStatus(b.id);
    
    // Pending sources first
    if (!aStatus.lastJob && bStatus.lastJob) return -1;
    if (aStatus.lastJob && !bStatus.lastJob) return 1;
    
    // Then by creation date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getSourceBorderColor = (sourceId: string) => {
    const { sourceDocuments, lastJob } = getSourceStatus(sourceId);
    
    if (sourceDocuments.length > 0 && lastJob?.status === 'success') {
      return 'border-green-300 bg-green-50';
    } else if (lastJob?.status === 'error') {
      return 'border-red-300 bg-red-50';
    } else if (lastJob?.status === 'running') {
      return 'border-blue-300 bg-blue-50';
    }
    return 'border-gray-200 bg-white';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fontes de Conhecimento</h2>
          <p className="text-gray-600">Gerencie e monitore suas fontes de dados</p>
        </div>
        {onNewSource && (
          <Button onClick={onNewSource} className="bg-blue-600 hover:bg-blue-700">
            + Nova Fonte
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar fonte
                </label>
                <Input
                  placeholder="Digite a URL ou parte dela..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtrar por status
                </label>
                <Select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
                  <option value="all">Todas ({sources.length})</option>
                  <option value="pending">Não testadas ({sources.filter(s => !jobs.find(j => j.source_id === s.id)).length})</option>
                  <option value="success">Com sucesso ({sources.filter(s => {
                    const { sourceDocuments, lastJob } = getSourceStatus(s.id);
                    return lastJob?.status === 'success' && sourceDocuments.length > 0;
                  }).length})</option>
                  <option value="error">Com erro ({sources.filter(s => {
                    const lastJob = jobs.filter(j => j.source_id === s.id).sort((a, b) => 
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )[0];
                    return lastJob?.status === 'error';
                  }).length})</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    fetchSources();
                    fetchDocuments();
                    fetchJobs();
                  }}
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources List */}
      <div className="grid gap-4">
        {sortedSources.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">
                {searchTerm || filter !== 'all' 
                  ? 'Nenhuma fonte encontrada com os filtros aplicados.'
                  : 'Nenhuma fonte cadastrada ainda.'
                }
              </div>
              {onNewSource && !searchTerm && filter === 'all' && (
                <Button 
                  onClick={onNewSource} 
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  Cadastrar primeira fonte
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedSources.map((source) => {
            const { sourceDocuments, lastJob } = getSourceStatus(source.id);
            const isSelected = selectedSourceId === source.id;
            
            return (
              <Card 
                key={source.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                } ${getSourceBorderColor(source.id)}`}
                onClick={() => onSourceSelect(source.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {source.url}
                        </h3>
                        <SourceStatus 
                          sourceId={source.id}
                          documents={sourceDocuments}
                          lastJob={lastJob}
                        />
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="capitalize">{source.scope}</span>
                        <span>Profundidade: {source.depth}</span>
                        <span>Criado: {new Date(source.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {lastJob && (
                        <div className="mt-2 text-xs text-gray-500">
                          Último crawl: {new Date(lastJob.created_at).toLocaleString('pt-BR')}
                          {lastJob.status === 'running' && (
                            <span className="ml-2 text-blue-600">🔄 Executando...</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="ml-4 text-blue-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
