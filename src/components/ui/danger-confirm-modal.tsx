'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

export interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Conteudo do corpo — geralmente uma lista do que sera perdido */
  description: ReactNode;
  /**
   * Texto exato que o usuario precisa digitar pra liberar o botao Excluir.
   * Geralmente o nome do recurso (ex: agent.name).
   */
  confirmPhrase: string;
  confirmButtonText?: string;
  busy?: boolean;
}

export function DangerConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmPhrase,
  confirmButtonText = 'Excluir definitivamente',
  busy = false,
}: Props) {
  const [typed, setTyped] = useState('');

  // Reseta o input toda vez que abre
  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  if (!isOpen) return null;

  const matches = typed.trim() === confirmPhrase.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div className="relative bg-card border-2 border-red-500/40 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        {/* Header chamativo */}
        <div className="bg-red-500/10 border-b border-red-500/30 p-5 flex items-start gap-3">
          <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-red-50 mb-0.5">{title}</h3>
            <p className="text-sm text-red-300 font-medium">Ação irreversível</p>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-5 space-y-4">
          <div className="text-sm text-foreground/90 leading-relaxed">{description}</div>

          <div>
            <label className="block text-xs text-muted-foreground mb-2">
              Para confirmar, digite{' '}
              <code className="px-1.5 py-0.5 bg-secondary rounded text-red-300 font-mono text-xs">
                {confirmPhrase}
              </code>{' '}
              abaixo:
            </label>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmPhrase}
              disabled={busy}
              className={matches ? 'border-red-500/60 focus:border-red-500' : ''}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex justify-end gap-2 bg-secondary/30">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="min-w-[180px]"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              confirmButtonText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
