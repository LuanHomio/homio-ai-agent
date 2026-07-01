'use client';

import { useState } from 'react';
import type { Notice } from './types';

// Logica compartilhada do CTA "Assinar" — chama POST /api/billing/checkout e
// trata os 2 modos de resposta do B2:
//   - {mode:'subscribed'}       => off-session no cartao salvo deu certo, ja ativo
//   - {mode:'checkout', url}     => abre o Stripe Checkout (NAO roda no iframe GHL)
export function usePlanCheckout() {
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function subscribe(slug: string) {
    setNotice(null);
    setCheckoutSlug(slug);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: slug }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setNotice({ type: 'success', text: 'Voce ja tem uma assinatura ativa.' });
        } else {
          setNotice({
            type: 'error',
            text: json?.detail || json?.error || 'Nao foi possivel iniciar a assinatura.',
          });
        }
        return;
      }

      if (json.mode === 'subscribed') {
        setNotice({ type: 'success', text: 'Assinatura ativada! Atualizando...' });
        setTimeout(() => window.location.reload(), 1200);
        return;
      }

      if (json.mode === 'checkout' && json.url) {
        window.open(json.url, '_blank', 'noopener');
        setNotice({
          type: 'success',
          text: 'Abrimos o checkout em uma nova aba. Conclua o pagamento por la.',
        });
        return;
      }

      setNotice({ type: 'error', text: 'Resposta inesperada do checkout.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message ?? 'Erro ao iniciar a assinatura.' });
    } finally {
      setCheckoutSlug(null);
    }
  }

  return { subscribe, checkoutSlug, notice };
}
