'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';

export interface MultiSelectOption {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = 'Selecione as opções',
  className = '',
  disabled = false
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter(option => selectedIds.includes(option.id));

  const handleToggle = (optionId: string) => {
    if (disabled) return;
    
    const newSelectedIds = selectedIds.includes(optionId)
      ? selectedIds.filter(id => id !== optionId)
      : [...selectedIds, optionId];
    
    onChange(newSelectedIds);
  };

  const handleRemove = (optionId: string) => {
    if (disabled) return;
    onChange(selectedIds.filter(id => id !== optionId));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected items display */}
      <div className="min-h-[40px] p-2 border border-gray-600 rounded-md bg-gray-700 flex flex-wrap gap-1">
        {selectedOptions.length === 0 ? (
          <span className="text-gray-400 text-sm py-1">{placeholder}</span>
        ) : (
          <>
            {selectedOptions.map(option => (
              <span
                key={option.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-800"
              >
                {option.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(option.id)}
                    className="hover:text-blue-300 ml-1"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {!disabled && selectedOptions.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-gray-400 hover:text-gray-300 text-xs px-1"
              >
                Limpar tudo
              </button>
            )}
          </>
        )}
      </div>

      {/* Dropdown button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="absolute right-1 top-1 h-8 w-8 p-0 bg-gray-700 border-gray-600 hover:bg-gray-600"
      >
        {isOpen ? '▲' : '▼'}
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-600">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Options list */}
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 ${
                    selectedIds.includes(option.id) ? 'bg-blue-900/30 text-blue-400' : 'text-gray-300'
                  }`}
                  onClick={() => handleToggle(option.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{option.name}</div>
                      {option.description && (
                        <div className="text-xs text-gray-400 mt-1">{option.description}</div>
                      )}
                      {option.type && (
                        <div className="text-xs text-gray-500 mt-1">
                          Tipo: {option.type}
                        </div>
                      )}
                    </div>
                    {selectedIds.includes(option.id) && (
                      <span className="text-blue-400">✓</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
