'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileText,
  FileType2,
  FileSpreadsheet,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

type DocumentItem = {
  id: string;
  knowledge_base_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  filename: string | null;
  mime: string | null;
  kind: 'pdf' | 'docx' | 'csv' | null;
  size_bytes: number | null;
  chunk_count: number | null;
  page_count: number | null;
  row_count: number | null;
  total_rows_in_source: number | null;
  truncated: boolean | null;
  error_message: string | null;
  created_at: string;
};

type Props = {
  knowledgeBaseId: string;
  agentId?: string | null;
  onCountChange?: (n: number) => void;
};

const ACCEPT = '.pdf,.docx,.csv';
const MAX_MB = 10;

function bytesToHuman(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindIcon(kind: DocumentItem['kind']) {
  if (kind === 'pdf') return <FileText className="w-5 h-5 text-red-300" />;
  if (kind === 'docx') return <FileType2 className="w-5 h-5 text-blue-300" />;
  if (kind === 'csv') return <FileSpreadsheet className="w-5 h-5 text-emerald-300" />;
  return <FileText className="w-5 h-5 text-muted-foreground" />;
}

function statusBadge(status: DocumentItem['status']) {
  const map = {
    pending: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: Clock },
    processing: { label: 'Processando', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', Icon: Loader2, spin: true },
    completed: { label: 'Pronto', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 },
    error: { label: 'Erro', cls: 'bg-red-500/15 text-red-300 border-red-500/30', Icon: XCircle },
  } as const;
  const { label, cls, Icon, spin } = map[status] as any;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${cls}`}>
      <Icon className={`w-3 h-3 ${spin ? 'animate-spin' : ''}`} /> {label}
    </span>
  );
}

export function DocumentsManager({ knowledgeBaseId, agentId, onCountChange }: Props) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/kb/documents?knowledge_base_id=${knowledgeBaseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: DocumentItem[] = data.items || [];
      setItems(list);
      onCountChange?.(list.length);
    } catch (err) {
      console.error('[documents-manager] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, onCountChange]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // polling enquanto houver pending/processing
  useEffect(() => {
    const hasInFlight = items.some((i) => i.status === 'pending' || i.status === 'processing');
    if (hasInFlight && !pollTimer.current) {
      pollTimer.current = setInterval(fetchItems, 2000);
    } else if (!hasInFlight && pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [items, fetchItems]);

  const handleFiles = async (files: FileList | File[]) => {
    setErrorMsg(null);
    const arr = Array.from(files);
    if (arr.length === 0) return;

    for (const file of arr) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setErrorMsg(`"${file.name}": maior que ${MAX_MB}MB`);
        continue;
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('knowledge_base_id', knowledgeBaseId);
      if (agentId) fd.append('agent_id', agentId);
      try {
        setUploading(true);
        const res = await fetch('/api/kb/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error || `HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.error('[documents-manager] upload failed:', err);
        setErrorMsg(`"${file.name}": ${err?.message ?? 'falha no upload'}`);
      } finally {
        setUploading(false);
      }
    }
    await fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este documento? Os chunks indexados também serao deletados.')) return;
    try {
      const res = await fetch(`/api/kb/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchItems();
    } catch (err: any) {
      console.error('[documents-manager] delete failed:', err);
      setErrorMsg(err?.message ?? 'falha ao remover');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-homio-purple-500 bg-homio-purple-500/10' : 'border-border bg-secondary/40 hover:bg-secondary/60'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-homio-purple-300" />
          ) : (
            <Upload className="w-6 h-6 text-homio-purple-300" />
          )}
          <div className="text-foreground font-medium">
            {uploading ? 'Enviando...' : 'Solte arquivos aqui ou clique para selecionar'}
          </div>
          <div className="text-xs">PDF, DOCX ou CSV — max {MAX_MB}MB</div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-red-500/40 bg-red-500/10 text-red-200 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-2">
        {loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" /> Carregando documentos...
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nenhum documento enviado ainda.
          </div>
        )}
        {items.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 p-3 rounded border border-border bg-card/60">
            {kindIcon(doc.kind)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm truncate" title={doc.filename ?? ''}>
                  {doc.filename ?? '(sem nome)'}
                </div>
                {statusBadge(doc.status)}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                <span>{bytesToHuman(doc.size_bytes)}</span>
                {doc.kind === 'pdf' && doc.page_count != null && <span>{doc.page_count} pg</span>}
                {doc.kind === 'csv' && doc.row_count != null && (
                  <span>
                    {doc.row_count} linha{doc.row_count === 1 ? '' : 's'}
                    {doc.truncated ? ` (de ${doc.total_rows_in_source}, truncado)` : ''}
                  </span>
                )}
                {doc.chunk_count != null && <span>{doc.chunk_count} chunks</span>}
                {doc.error_message && <span className="text-red-300">erro: {doc.error_message}</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)} disabled={doc.status === 'processing'}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
