'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  id: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
};

export function CopyableId({ id, label = 'ID', className, iconOnly = false }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback silencioso
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ${className ?? ''}`}
        title={copied ? `${label} copiado` : `Copiar ${label}: ${id}`}
        aria-label={`Copiar ${label}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-300" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ${className ?? ''}`}
      title={`Copiar ${label}: ${id}`}
    >
      <span className="opacity-60">{label}:</span>
      <span className="tabular-nums">{id}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-300" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}
