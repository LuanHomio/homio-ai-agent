'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/contexts/agent-context';
import {
  Loader2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MinusCircle,
  SlidersHorizontal,
  X,
} from 'lucide-react';

type JobSummary = {
  gemini_calls: number;
  tool_count: number;
  total_tokens: number | null;
  final_finish_reason: string | null;
  tool_names: string[];
};

type JobRow = {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped';
  message_text: string | null;
  response_text: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  summary: JobSummary;
};

type Totals = {
  total_jobs: number;
  total_tokens: number;
  total_latency_ms: number;
  avg_latency_ms: number | null;
  sample_capped: boolean;
};

type SearchField = 'message' | 'response' | 'both';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'completed', label: 'Concluido' },
  { value: 'error', label: 'Erro' },
  { value: 'skipped', label: 'Pulado' },
  { value: 'processing', label: 'Processando' },
  { value: 'pending', label: 'Pendente' },
];

const SEARCH_FIELD_OPTIONS: Array<{ value: SearchField; label: string }> = [
  { value: 'message', label: 'Mensagem' },
  { value: 'response', label: 'Resposta' },
  { value: 'both', label: 'Ambos' },
];

function statusBadge(status: JobRow['status']) {
  const map: Record<JobRow['status'], { label: string; classes: string; icon: any }> = {
    completed: { label: 'Concluido', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    error: { label: 'Erro', classes: 'bg-red-500/15 text-red-300 border-red-500/30', icon: XCircle },
    skipped: { label: 'Pulado', classes: 'bg-gray-500/15 text-gray-300 border-gray-500/30', icon: MinusCircle },
    processing: { label: 'Processando', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Clock },
    pending: { label: 'Pendente', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock },
  };
  const { label, classes, icon: Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${classes}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function formatLatency(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(n: number | null) {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function isoFromDateInput(value: string, endOfDay: boolean): string | null {
  if (!value) return null;
  // input type=date envia YYYY-MM-DD. Anexa hora local pra cobrir o dia inteiro.
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const d = new Date(`${value}${suffix}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function LogsTabPage() {
  const { agentId } = useAgent();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const [items, setItems] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros basicos
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('message');

  // filtros avancados
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minLatency, setMinLatency] = useState('');
  const [maxLatency, setMaxLatency] = useState('');
  const [toolName, setToolName] = useState('');

  // applied (separa input ao vivo do que dispara fetch)
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [appliedMinLatency, setAppliedMinLatency] = useState('');
  const [appliedMaxLatency, setAppliedMaxLatency] = useState('');
  const [appliedToolName, setAppliedToolName] = useState('');

  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const activeAdvancedCount = useMemo(() => {
    let n = 0;
    if (appliedFromDate) n += 1;
    if (appliedToDate) n += 1;
    if (appliedMinLatency) n += 1;
    if (appliedMaxLatency) n += 1;
    if (appliedToolName) n += 1;
    if (searchField !== 'message') n += 1;
    return n;
  }, [appliedFromDate, appliedToDate, appliedMinLatency, appliedMaxLatency, appliedToolName, searchField]);

  const fetchJobs = async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      if (appliedSearch) sp.set('search', appliedSearch);
      if (searchField !== 'message') sp.set('search_field', searchField);
      const fromIso = isoFromDateInput(appliedFromDate, false);
      const toIso = isoFromDateInput(appliedToDate, true);
      if (fromIso) sp.set('from', fromIso);
      if (toIso) sp.set('to', toIso);
      if (appliedMinLatency) sp.set('min_latency_ms', appliedMinLatency);
      if (appliedMaxLatency) sp.set('max_latency_ms', appliedMaxLatency);
      if (appliedToolName) sp.set('tool_name', appliedToolName);
      sp.set('limit', String(LIMIT));
      sp.set('offset', String(offset));
      const res = await fetch(`/api/agents/${agentId}/jobs?${sp.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotals(data.totals ?? null);
      if (Array.isArray(data.tool_names)) setToolNames(data.tool_names);
    } catch (err) {
      console.error('[logs] fetch falhou:', err);
      setItems([]);
      setTotal(0);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    agentId,
    status,
    appliedSearch,
    searchField,
    appliedFromDate,
    appliedToDate,
    appliedMinLatency,
    appliedMaxLatency,
    appliedToolName,
    offset,
  ]);

  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  const buildDetailHref = (jobId: string) => `/agents/${agentId}/logs/${jobId}${qs ? `?${qs}` : ''}`;

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setAppliedSearch(search.trim());
  };

  const applyAdvanced = () => {
    setOffset(0);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedMinLatency(minLatency);
    setAppliedMaxLatency(maxLatency);
    setAppliedToolName(toolName);
  };

  const clearAdvanced = () => {
    setFromDate('');
    setToDate('');
    setMinLatency('');
    setMaxLatency('');
    setToolName('');
    setSearchField('message');
    setOffset(0);
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedMinLatency('');
    setAppliedMaxLatency('');
    setAppliedToolName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Logs de execucao</h2>
          <p className="text-sm text-muted-foreground">Cada inbound message processada pelo agent vira um job aqui.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchJobs()}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-border hover:bg-accent"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={onSubmitSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              searchField === 'response'
                ? 'Buscar na resposta do agent...'
                : searchField === 'both'
                ? 'Buscar em mensagem ou resposta...'
                : 'Buscar na mensagem inbound...'
            }
            className="w-full pl-9 pr-3 py-2 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
          />
        </form>
        <select
          value={status}
          onChange={(e) => { setOffset(0); setStatus(e.target.value); }}
          className="px-3 py-2 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded border ${
            activeAdvancedCount > 0
              ? 'border-homio-purple-500/60 bg-homio-purple-500/10 text-homio-purple-200'
              : 'border-border hover:bg-accent'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros avancados
          {activeAdvancedCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs bg-homio-purple-500 text-white">
              {activeAdvancedCount}
            </span>
          )}
        </button>
      </div>

      {advancedOpen && (
        <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase text-muted-foreground mb-1">Buscar em</label>
              <div className="inline-flex rounded border border-border overflow-hidden">
                {SEARCH_FIELD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setOffset(0); setSearchField(opt.value); }}
                    className={`px-3 py-1.5 text-xs ${
                      searchField === opt.value ? 'bg-homio-purple-500/20 text-homio-purple-200' : 'hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase text-muted-foreground mb-1">Tool / Action</label>
              <select
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
              >
                <option value="">Qualquer</option>
                {toolNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs uppercase text-muted-foreground mb-1">De</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-muted-foreground mb-1">Ate</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs uppercase text-muted-foreground mb-1">Latencia min (ms)</label>
                <input
                  type="number"
                  min={0}
                  value={minLatency}
                  onChange={(e) => setMinLatency(e.target.value)}
                  placeholder="ex: 1000"
                  className="w-full px-3 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-muted-foreground mb-1">Latencia max (ms)</label>
                <input
                  type="number"
                  min={0}
                  value={maxLatency}
                  onChange={(e) => setMaxLatency(e.target.value)}
                  placeholder="ex: 30000"
                  className="w-full px-3 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-homio-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={clearAdvanced}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-accent text-muted-foreground"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
            <button
              type="button"
              onClick={applyAdvanced}
              className="text-xs px-3 py-1.5 rounded bg-homio-purple-500 text-white hover:bg-homio-purple-400"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {totals && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground border-b border-border pb-2">
          <span><span className="text-foreground font-medium">{totals.total_jobs}</span> jobs no filtro</span>
          <span>~<span className="text-foreground font-medium">{formatTokens(totals.total_tokens || null)}</span> tokens</span>
          <span>media <span className="text-foreground font-medium">{formatLatency(totals.avg_latency_ms ?? null)}</span></span>
          {totals.sample_capped && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <AlertTriangle className="w-3 h-3" /> agregados estimados (top 1000 jobs)
            </span>
          )}
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Quando</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Mensagem</th>
              <th className="px-3 py-2 text-left font-medium">Resposta</th>
              <th className="px-3 py-2 text-right font-medium">Latencia</th>
              <th className="px-3 py-2 text-right font-medium">Tokens</th>
              <th className="px-3 py-2 text-right font-medium">Tools</th>
              <th className="px-3 py-2 text-left font-medium">Finish</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 inline-block animate-spin mr-2" /> Carregando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum job encontrado.
                </td>
              </tr>
            )}
            {items.map((job) => {
              const finish = job.summary?.final_finish_reason;
              const finishColor = finish === 'STOP' ? 'text-emerald-300'
                : finish === 'SAFETY' || finish === 'RECITATION' ? 'text-red-300'
                : finish === 'MAX_TOKENS' ? 'text-amber-300'
                : 'text-muted-foreground';
              return (
                <tr key={job.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground">
                    <Link href={buildDetailHref(job.id)} className="hover:text-foreground">
                      {formatTime(job.created_at)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top">{statusBadge(job.status)}</td>
                  <td className="px-3 py-2 align-top max-w-xs">
                    <Link href={buildDetailHref(job.id)} className="block truncate hover:text-foreground" title={job.message_text ?? ''}>
                      {job.message_text || <span className="text-muted-foreground italic">vazio</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top max-w-xs text-muted-foreground truncate" title={job.response_text ?? ''}>
                    {job.response_text || (job.error_message ? <span className="text-red-300">{job.error_message}</span> : '—')}
                  </td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">{formatLatency(job.processing_time_ms)}</td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">{formatTokens(job.summary?.total_tokens ?? null)}</td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">{job.summary?.tool_count ?? 0}</td>
                  <td className={`px-3 py-2 align-top text-xs ${finishColor}`}>{finish ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{total > 0 ? `Mostrando ${offset + 1}-${Math.min(offset + LIMIT, total)} de ${total}` : ''}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={!hasPrev || loading}
            className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setOffset(offset + LIMIT)}
            disabled={!hasNext || loading}
            className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-accent"
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
}
