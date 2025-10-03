'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs = [
    { id: 'sources', label: '📚 Fontes', description: 'Gerenciar fontes de conhecimento' },
    { id: 'crawler', label: '🕷️ Crawler', description: 'Executar crawls e monitorar status' },
    { id: 'faqs', label: '❓ FAQs', description: 'Perguntas e respostas frequentes' }
  ];

  return (
    <div className="bg-white border-b border-gray-200 mb-8">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
