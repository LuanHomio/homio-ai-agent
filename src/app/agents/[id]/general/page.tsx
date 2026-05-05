'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAgent } from '@/contexts/agent-context';
import { Settings, Loader2 } from 'lucide-react';

export default function GeneralTabPage() {
  const { agent, setAgent, loading, updateAgent } = useAgent();
  const [companyName, setCompanyName] = useState('');

  if (!agent) return null;

  return (
    <div className="space-y-8 animate-slide-up">
      <section className="space-y-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Informações Básicas</h3>
            <p className="text-muted-foreground">Configure as informações básicas do seu agent</p>
          </div>
          <Button variant="outline">Definir como Principal</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">Nome do Agent *</label>
            <Input
              value={agent.name}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              placeholder="Ex: Agente de Vendas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">Nome da Empresa</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Minha Empresa Ltda"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground/80 mb-2">Descrição</label>
            <Textarea
              value={agent.description || ''}
              onChange={(e) => setAgent((prev) => (prev ? { ...prev, description: e.target.value } : null))}
              placeholder="Descreva o propósito e função deste agent..."
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            <Settings className="w-5 h-5 inline-block mr-2" />
            Configurações Avançadas
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">Status do Agent</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={agent.is_active}
                    onChange={() => setAgent((prev) => (prev ? { ...prev, is_active: true } : null))}
                    className="mr-2 text-homio-purple-600"
                  />
                  <span className="text-foreground/80">Ativo</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={!agent.is_active}
                    onChange={() => setAgent((prev) => (prev ? { ...prev, is_active: false } : null))}
                    className="mr-2 text-homio-purple-600"
                  />
                  <span className="text-foreground/80">Inativo</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4">
        <Button
          onClick={updateAgent}
          disabled={loading}
          className="bg-gradient-to-r from-homio-purple-600 to-homio-purple-500 hover:from-homio-purple-500 hover:to-homio-purple-400 shadow-lg shadow-homio-purple-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
            </>
          ) : (
            'Salvar Detalhes'
          )}
        </Button>
      </div>
    </div>
  );
}
