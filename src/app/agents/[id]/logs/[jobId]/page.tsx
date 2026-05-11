'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAgent } from '@/contexts/agent-context';
import {
  ArrowLeft, Loader2, Bot, User, Wrench, Sparkles, AlertTriangle, CheckCircle2, XCircle,
  Clock, Hash, MessageSquare, Activity, Copy,
} from 'lucide-react';

type Source = Record<string, any> & {
  at?: string;
  source?: string;
  step?: string;
};

type JobDetail = {
  id: string;
  agent_id: string;
  conversation_id: string | null;
  contact_id: string;
  status: string | null;
  message_text: string | null;
  response_text: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  context_sources: Source[] | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatLatency(ms?: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function formatTime(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { label: string; classes: string }> = {
    completed: { label: 'Concluido', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    error: { label: 'Erro', classes: 'bg-red-500/15 text-red-300 border-red-500/30' },
    skipped: { label: 'Pulado', classes: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
    processing: { label: 'Processando', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    pending: { label: 'Pendente', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  };
  const { label, classes } = map[status ?? ''] ?? { label: status ?? '—', classes: 'bg-gray-500/15 text-gray-300 border-gray-500/30' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${classes}`}>{label}</span>;
}

function FinishReasonPill({ reason }: { reason: string | null | undefined }) {
  if (!reason) return null;
  const cls = reason === 'STOP' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : reason === 'SAFETY' || reason === 'RECITATION' ? 'text-red-300 border-red-500/30 bg-red-500/10'
    : reason === 'MAX_TOKENS' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
    : 'text-muted-foreground border-border bg-muted/30';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${cls}`}>{reason}</span>;
}

function nodeMeta(source: Source) {
  const s = source.source;
  if (s === 'gemini_loop_start') return { icon: Sparkles, color: 'text-violet-300', label: 'Inicio do loop Gemini' };
  if (s === 'gemini_call') return { icon: Bot, color: 'text-violet-300', label: `Gemini call #${(source.iter ?? 0) + 1}` };
  if (s === 'gemini_text_response') return { icon: MessageSquare, color: 'text-emerald-300', label: 'Resposta do Gemini' };
  if (s === 'agent_action') return { icon: Wrench, color: 'text-fuchsia-300', label: `Action: ${source.name ?? ''}` };
  if (s === 'tool_call') return { icon: Wrench, color: 'text-sky-300', label: `Tool: ${source.name ?? ''}` };
  if (s === 'kb_retrieval') return { icon: Hash, color: 'text-amber-300', label: 'Busca KB' };
  if (s === 'ghl_contact_prefetch') return { icon: User, color: 'text-sky-300', label: 'Prefetch contato GHL' };
  if (s === 'decision_trace') return { icon: Activity, color: 'text-muted-foreground', label: `Decision: ${source.step ?? ''}` };
  return { icon: Activity, color: 'text-muted-foreground', label: s ?? 'step' };
}

function shortJson(v: any, max = 100) {
  if (v == null) return '';
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > max ? s.substring(0, max) + '…' : s;
  } catch {
    return String(v);
  }
}

function TimelineNode({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const meta = nodeMeta(source);
  const Icon = meta.icon;
  const okFlag = source.ok;
  const isError = okFlag === false || source.source === 'gemini_text_response' && okFlag === false;
  const hasDetails = Object.keys(source).some((k) => !['at', 'source', 'step', 'ok'].includes(k));

  const subline = useMemo(() => {
    const bits: string[] = [];
    if (typeof source.latency_ms === 'number') bits.push(formatLatency(source.latency_ms));
    if (source.tokens?.total) bits.push(`${formatTokens(source.tokens.total)} toks`);
    if (source.decision) bits.push(source.decision);
    if (source.tool_name) bits.push(source.tool_name);
    if (source.status !== undefined && source.source === 'tool_call') bits.push(`HTTP ${source.status}`);
    if (source.error) bits.push(`erro: ${shortJson(source.error, 60)}`);
    if (source.args_preview) bits.push(`args: ${shortJson(source.args_preview, 50)}`);
    if (source.result_preview) bits.push(`result: ${shortJson(source.result_preview, 50)}`);
    if (source.reply_preview) bits.push(`reply: ${shortJson(source.reply_preview, 60)}`);
    if (source.prompt_preview) bits.push(`prompt: ${shortJson(source.prompt_preview, 60)}`);
    return bits.join(' · ');
  }, [source]);

  return (
    <li className="relative pl-7">
      <span className="absolute left-1.5 top-2.5 w-2.5 h-2.5 rounded-full bg-border ring-2 ring-background" />
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`w-full text-left py-2 px-3 rounded border ${isError ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card/60'} hover:bg-accent/40 transition-colors`}
      >
        <div className="flex items-start gap-2">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium text-foreground">
                {meta.label}
              </div>
              <div className="flex items-center gap-1.5">
                {source.finishReason && <FinishReasonPill reason={source.finishReason} />}
                {okFlag === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {okFlag === false && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                <span className="text-[11px] text-muted-foreground tabular-nums">{source.at?.substring(11, 23) ?? ''}</span>
              </div>
            </div>
            {subline && <div className="text-xs text-muted-foreground mt-0.5 break-words">{subline}</div>}
          </div>
        </div>
      </button>
      {open && hasDetails && (
        <div className="mt-1.5 ml-1 rounded border border-border bg-background/60 p-3 text-xs">
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono leading-relaxed">{JSON.stringify(source, null, 2)}</pre>
        </div>
      )}
    </li>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string; jobId: string }>();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const { agentId } = useAgent();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId || !params.jobId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/${agentId}/jobs/${params.jobId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelled) { setJob(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, params.jobId]);

  const sources = useMemo(() => (Array.isArray(job?.context_sources) ? job!.context_sources : []), [job]);

  const totalTokens = useMemo(() => {
    return sources
      .filter((s) => s.source === 'gemini_call')
      .reduce((acc, s) => acc + (Number(s?.tokens?.total) || 0), 0);
  }, [sources]);

  const backHref = `/agents/${agentId}/logs${qs ? `?${qs}` : ''}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando job...
      </div>
    );
  }
  if (error || !job) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
        <div className="text-sm text-muted-foreground">Nao foi possivel carregar esse job. {error}</div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-homio-purple-300 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar pra lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar pra lista
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> {formatTime(job.created_at)} ·
          <span className="tabular-nums">{formatLatency(job.processing_time_ms)}</span> ·
          <span className="tabular-nums">{formatTokens(totalTokens)} toks</span> ·
          <StatusPill status={job.status} />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(job.id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:bg-accent text-xs"
            title="Copiar Job ID"
          >
            <Copy className="w-3 h-3" /> ID
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-homio-purple-300" /> Conversa
          </h3>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" /> Cliente
                <span className="ml-auto font-mono text-[10px] truncate" title={job.contact_id}>{job.contact_id}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">
                {job.message_text || <span className="text-muted-foreground italic">(vazio)</span>}
              </div>
            </div>

            <div className={`rounded-lg border ${job.status === 'error' ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card/60'} p-3`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-300" /> Agent
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">
                {job.response_text || (job.error_message
                  ? <span className="text-red-300">{job.error_message}</span>
                  : <span className="text-muted-foreground italic">(sem resposta)</span>)}
              </div>
            </div>
          </div>

          {job.conversation_id && (
            <div className="text-xs text-muted-foreground">
              Conversation: <span className="font-mono">{job.conversation_id}</span>
            </div>
          )}
        </section>

        <section className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-homio-purple-300" /> Execution timeline
            </h3>
            <span className="text-xs text-muted-foreground">{sources.length} eventos</span>
          </div>
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded border border-dashed border-border p-6 text-center">
              Esse job nao registrou nenhum evento no context_sources.
            </div>
          ) : (
            <ol className="relative space-y-1.5 border-l border-border ml-1">
              {sources.map((s, idx) => (
                <TimelineNode key={idx} source={s} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
