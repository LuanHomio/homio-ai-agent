'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { usePlanCheckout } from './usePlanCheckout';
import { PlansGrid, NoticeBanner } from './PlansGrid';
import type { OverviewResponse } from './types';

// Faixa de upsell compacta e dispensavel, mostrada pra location no plano free
// (gate SOFT — nao bloqueia o app).
export function BillingUpsell({ overview }: { overview: OverviewResponse }) {
  const { subscribe, checkoutSlug, notice } = usePlanCheckout();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-10 animate-slide-up">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-homio-purple-300 text-xs font-semibold uppercase tracking-wide mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Fazer upgrade
          </div>
          <h3 className="text-xl font-bold text-foreground">Precisa de mais mensagens?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Voce esta no plano gratuito. Faca upgrade para mais mensagens e menor custo de excedente.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Agora nao
        </button>
      </div>

      {notice && <NoticeBanner notice={notice} />}

      <PlansGrid
        plans={overview.plans}
        currentSlug={overview.subscription?.plan_slug}
        checkoutSlug={checkoutSlug}
        onSubscribe={subscribe}
      />
    </div>
  );
}
