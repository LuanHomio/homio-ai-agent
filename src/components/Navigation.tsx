'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedLocationId?: string;
}

export function Navigation({ activeTab, onTabChange, selectedLocationId }: NavigationProps) {
  const tabs = [
    { id: 'agents', label: '🤖 Agents', description: 'Gerenciar agentes' },
    { id: 'sources', label: '📚 Fontes', description: 'Gerenciar fontes de conhecimento' },
    { id: 'crawler', label: '🕷️ Crawler', description: 'Executar crawls e monitorar status' },
    { id: 'faqs', label: '❓ FAQs', description: 'Perguntas e respostas frequentes' }
  ];

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 mb-8">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
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
    </div>
  );
}
