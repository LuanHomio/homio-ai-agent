'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/contexts/agent-context';
import { Loader2, RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertTriangle, MinusCircle } from 'lucide-react';

type JobSummary = {
  gemini_calls: number;
  tool_count: number;
  total_tokens: number | null;
  final_finish_reason: string | null;
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

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'completed', label: 'Concluido' },
  { value: 'error', label: 'Erro' },
  { value: 'skipped', label: 'Pulado' },
  { value: 'processing', label: 'Processando' },
  { value: 'pending', label: 'Pendente' },
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

export default function LogsTabPage() {
  const { agentId } = useAgent();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const [items, setItems] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const fetchJobs = async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      if (appliedSearch) sp.set('search', appliedSearch);
      sp.set('limit', String(LIMIT));
      sp.set('offset', String(offset));
      const res = await fetch(`/api/agents/${agentId}/jobs?${sp.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('[logs] fetch falhou:', err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, status, appliedSearch, offset]);

  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  const buildDetailHref = (jobId: string) => `/agents/${agentId}/logs/${jobId}${qs ? `?${qs}` : ''}`;

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setAppliedSearch(search.trim());
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
            placeholder="Buscar na mensagem inbound..."
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
      </div>

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
