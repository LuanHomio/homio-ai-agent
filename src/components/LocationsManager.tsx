'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Location, CreateLocationRequest, UpdateLocationRequest } from '@/lib/types';

interface LocationsManagerProps {
  onLocationSelect?: (locationId: string) => void;
  selectedLocationId?: string;
}

export function LocationsManager({ onLocationSelect, selectedLocationId }: LocationsManagerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewLocationForm, setShowNewLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newLocation, setNewLocation] = useState<CreateLocationRequest>({
    name: '',
    description: '',
    slug: '',
    ghl_location_id: '',
    settings: {}
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) throw new Error('Failed to fetch locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
      showMessage('error', 'Erro ao carregar locations');
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async () => {
    if (!newLocation.name || !newLocation.slug) {
      showMessage('error', 'Nome e slug são obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create location');
      }

      const location = await response.json();
      setLocations(prev => [location, ...prev]);
      setNewLocation({ name: '', description: '', slug: '', ghl_location_id: '', settings: {} });
      setShowNewLocationForm(false);
      showMessage('success', 'Location criada com sucesso!');
    } catch (error) {
      console.error('Error creating location:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar location');
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async () => {
    if (!editingLocation) return;

    setLoading(true);
    try {
      const updateData: UpdateLocationRequest = {
        name: editingLocation.name,
        description: editingLocation.description,
        slug: editingLocation.slug,
        ghl_location_id: editingLocation.ghl_location_id,
        settings: editingLocation.settings
      };

      const response = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update location');
      }

      const updatedLocation = await response.json();
      setLocations(prev => prev.map(loc => loc.id === updatedLocation.id ? updatedLocation : loc));
      setEditingLocation(null);
      showMessage('success', 'Location atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating location:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar location');
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta location? Esta ação não pode ser desfeita.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete location');
      }

      setLocations(prev => prev.filter(loc => loc.id !== id));
      showMessage('success', 'Location excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting location:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao excluir location');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (newLocation.name && !newLocation.slug) {
      setNewLocation(prev => ({ ...prev, slug: generateSlug(prev.name) }));
    }
  }, [newLocation.name]);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🏢 Locations</h2>
        <Button 
          onClick={() => setShowNewLocationForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Nova Location
        </Button>
      </div>

      {loading && locations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Carregando locations...</div>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 mb-4">Nenhuma location cadastrada ainda.</p>
            <Button 
              onClick={() => setShowNewLocationForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Criar Primeira Location
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card 
              key={location.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedLocationId === location.id 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : ''
              }`}
              onClick={() => onLocationSelect?.(location.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{location.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      /{location.slug}
                    </CardDescription>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    location.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {location.is_active ? 'Ativa' : 'Inativa'}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {location.description && (
                  <p className="text-sm text-gray-600 mb-3">{location.description}</p>
                )}
                {location.ghl_location_id && (
                  <p className="text-xs text-blue-600 mb-3">
                    GHL ID: {location.ghl_location_id}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLocation(location);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLocation(location.id);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Location Modal */}
      <Modal
        isOpen={showNewLocationForm}
        onClose={() => setShowNewLocationForm(false)}
        title="🏢 Nova Location"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <Input
              value={newLocation.name}
              onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Matriz São Paulo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <Input
              value={newLocation.slug}
              onChange={(e) => setNewLocation(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="Ex: matriz-sp"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL amigável (letras minúsculas, números, hífens)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <Textarea
              value={newLocation.description}
              onChange={(e) => setNewLocation(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição da location..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GoHighLevel Location ID
            </label>
            <Input
              value={newLocation.ghl_location_id}
              onChange={(e) => setNewLocation(prev => ({ ...prev, ghl_location_id: e.target.value }))}
              placeholder="ID da location no GHL (opcional)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowNewLocationForm(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={createLocation}
              disabled={loading || !newLocation.name || !newLocation.slug}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Criando...' : 'Criar Location'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        isOpen={!!editingLocation}
        onClose={() => setEditingLocation(null)}
        title="✏️ Editar Location"
      >
        {editingLocation && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <Input
                value={editingLocation.name}
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug *
              </label>
              <Input
                value={editingLocation.slug}
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, slug: e.target.value } : null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <Textarea
                value={editingLocation.description || ''}
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, description: e.target.value } : null)}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GoHighLevel Location ID
              </label>
              <Input
                value={editingLocation.ghl_location_id || ''}
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, ghl_location_id: e.target.value } : null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editingLocation.is_active}
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Location ativa
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingLocation(null)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={updateLocation}
                disabled={loading || !editingLocation.name || !editingLocation.slug}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
