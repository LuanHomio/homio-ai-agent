'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { Agent, CreateAgentRequest, KnowledgeBase } from '@/lib/types';

export default function NewAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId') || 'd8voPwkhJK7k7S5xjHcA';
  
  const [activeTab, setActiveTab] = useState('configuracoes');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [agent, setAgent] = useState<CreateAgentRequest>({
    location_id: locationId,
    name: '',
    description: '',
    personality: '',
    objective: '',
    additional_info: '',
    system_prompt: '',
    dify_app_id: '',
    settings: {}
  });

  const [companyName, setCompanyName] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchKnowledgeBases = async () => {
    try {
      const response = await fetch(`/api/knowledge-bases?location_id=${locationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge bases');
      }
      const data = await response.json();
      setKnowledgeBases(data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      showMessage('error', 'Erro ao carregar bases de conhecimento');
    }
  };

  const createAgent = async () => {
    if (!agent.name) {
      showMessage('error', 'Nome do agent é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create agent');
      }

      const createdAgent = await response.json();
      
      // Update knowledge bases if any are selected
      if (selectedKnowledgeBases.length > 0) {
        const kbResponse = await fetch(`/api/agents/${createdAgent.id}/knowledge-bases`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knowledge_base_ids: selectedKnowledgeBases })
        });

        if (!kbResponse.ok) {
          console.warn('Agent created but failed to update knowledge bases');
        }
      }

      showMessage('success', 'Agent criado com sucesso!');
      
      // Redirect to agent edit page
      router.push(`/agents/${createdAgent.id}?locationId=${locationId}`);
    } catch (error) {
      console.error('Error creating agent:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar agent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, [locationId]);

  const tabs = [
    { id: 'configuracoes', label: '⚙️ Configurações', description: 'Detalhes básicos do agent' },
    { id: 'prompt', label: '💬 Prompt', description: 'Personalidade e objetivos' },
    { id: 'conhecimento', label: '📚 Base de Conhecimento', description: 'Fontes e FAQs' }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header Section */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {agent.name || 'Novo Agent'}
              </h1>
              <p className="text-gray-400">
                Configure seu agent de IA para automatizar conversas
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={createAgent}
                disabled={loading || !agent.name}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Criando...' : 'Criar Agent'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8">
        {message && (
          <div className={`p-4 rounded-md mb-6 ${
            message.type === 'success' 
              ? 'bg-green-900/30 text-green-400 border border-green-800' 
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Bot Details Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Detalhes do Agent</h2>
              <p className="text-gray-400">Configure as informações básicas do seu agent</p>
            </div>
            <Button
              variant="outline"
              className="bg-blue-900/30 border-blue-800 text-blue-400 hover:bg-blue-800/30"
            >
              Definir como Principal
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome do Agent *
              </label>
              <Input
                value={agent.name}
                onChange={(e) => setAgent(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Agente de Vendas"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Empresa
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Minha Empresa Ltda"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descrição
              </label>
              <Textarea
                value={agent.description}
                onChange={(e) => setAgent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o propósito e função deste agent..."
                rows={3}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="border-b border-gray-700">
            <div className="flex space-x-1 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400 bg-blue-900/30'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-lg">{tab.label}</span>
                    <span className="text-xs opacity-75">{tab.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'configuracoes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Configurações Avançadas</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Dify App ID
                      </label>
                      <Input
                        value={agent.dify_app_id}
                        onChange={(e) => setAgent(prev => ({ ...prev, dify_app_id: e.target.value }))}
                        placeholder="ID da aplicação no Dify (opcional)"
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Status do Agent
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="active"
                            defaultChecked
                            className="mr-2 text-blue-600"
                          />
                          <span className="text-gray-300">Ativo</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="status"
                            value="inactive"
                            className="mr-2 text-blue-600"
                          />
                          <span className="text-gray-300">Inativo</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Configuração de Prompt</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Tooltip content="Is the bot you or your assistant? Are they formal or sarcastic? Tell the bot who it is and how it can meet its goals and things to keep in mind while talking to the contact.">
                          <span className="cursor-help">Personalidade ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.personality}
                        onChange={(e) => setAgent(prev => ({ ...prev, personality: e.target.value }))}
                        placeholder="Ex: Amigável, profissional, focado em resultados..."
                        rows={3}
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Tooltip content="The bot's goal. Use this space to define what the bot's goal is like assisting with question answers, booking an appointment etc.">
                          <span className="cursor-help">Objetivo ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.objective}
                        onChange={(e) => setAgent(prev => ({ ...prev, objective: e.target.value }))}
                        placeholder="Ex: Atender dúvidas sobre produtos, agendar consultas..."
                        rows={3}
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Tooltip content="Important Business info, why the conversation is happening, who the contact is, rules to follow, etc. Add anything you need the bot to know which will help it automate your conversations and respond to your contacts">
                          <span className="cursor-help">Informações Adicionais ?</span>
                        </Tooltip>
                      </label>
                      <Textarea
                        value={agent.additional_info}
                        onChange={(e) => setAgent(prev => ({ ...prev, additional_info: e.target.value }))}
                        placeholder="Ex: Horário de funcionamento, políticas da empresa, informações de contato..."
                        rows={4}
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        System Prompt
                      </label>
                      <Textarea
                        value={agent.system_prompt}
                        onChange={(e) => setAgent(prev => ({ ...prev, system_prompt: e.target.value }))}
                        placeholder="Prompt do sistema para o agent..."
                        rows={4}
                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'conhecimento' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Bases de Conhecimento</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Selecionar Bases de Conhecimento
                      </label>
                      <p className="text-sm text-gray-400 mb-3">
                        Escolha quais bases de conhecimento este agent deve utilizar para responder perguntas
                      </p>
                      <MultiSelect
                        options={knowledgeBases.map(kb => ({
                          id: kb.id,
                          name: kb.name,
                          description: kb.description,
                          type: kb.type
                        }))}
                        selectedIds={selectedKnowledgeBases}
                        onChange={setSelectedKnowledgeBases}
                        placeholder="Selecione as bases de conhecimento..."
                        className="w-full"
                      />
                    </div>

                    <div className="text-sm text-gray-400">
                      {selectedKnowledgeBases.length} base(s) selecionada(s)
                    </div>

                    {knowledgeBases.length === 0 && (
                      <div className="bg-gray-700 rounded-lg p-6 border border-gray-600 text-center">
                        <div className="text-4xl mb-4">📚</div>
                        <h4 className="text-lg font-semibold text-white mb-2">
                          Nenhuma Base de Conhecimento Disponível
                        </h4>
                        <p className="text-gray-400 mb-4">
                          Crie bases de conhecimento para esta location primeiro
                        </p>
                        <Button
                          variant="outline"
                          className="bg-blue-900/30 border-blue-800 text-blue-400 hover:bg-blue-800/30"
                        >
                          Gerenciar Bases de Conhecimento
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
