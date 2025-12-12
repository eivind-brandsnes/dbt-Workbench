import React, { useEffect, useState } from 'react';
import { Environment, EnvironmentCreate, EnvironmentUpdate } from '../types';
import { EnvironmentService } from '../services/environmentService';
import { useAuth } from '../context/AuthContext';

type Mode = 'list' | 'create' | 'edit';

function EnvironmentsPage() {
  const { user, isAuthEnabled } = useAuth();
  const isDeveloperOrAdmin = !isAuthEnabled || user?.role === 'developer' || user?.role === 'admin';

  const [mode, setMode] = useState<Mode>('list');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [form, setForm] = useState<EnvironmentCreate | EnvironmentUpdate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const envs = await EnvironmentService.list();
      setEnvironments(envs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environments');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClick = () => {
    if (!isDeveloperOrAdmin) return;
    setForm({
      name: '',
      description: '',
      dbt_target_name: '',
      connection_profile_reference: '',
      variables: {},
    });
    setSelectedEnvironment(null);
    setMode('create');
    setError(null);
  };

  const handleEditClick = (env: Environment) => {
    if (!isDeveloperOrAdmin) return;
    setSelectedEnvironment(env);
    setForm({
      name: env.name,
      description: env.description || '',
      dbt_target_name: env.dbt_target_name || '',
      connection_profile_reference: env.connection_profile_reference || '',
      variables: env.variables || {},
    });
    setMode('edit');
  };

  const handleFormChange = (field: keyof (EnvironmentCreate | EnvironmentUpdate), value: any) => {
    if (form) {
      setForm(prev => ({ ...prev!, [field]: value }));
    }
  };

  const handleSave = async () => {
    if (!isDeveloperOrAdmin || !form) return;
    if (!form.name) {
      setError('Environment name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (mode === 'create') {
        await EnvironmentService.create(form as EnvironmentCreate);
      } else if (mode === 'edit' && selectedEnvironment) {
        await EnvironmentService.update(selectedEnvironment.id, form as EnvironmentUpdate);
      }
      await loadData();
      setMode('list');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save environment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isDeveloperOrAdmin) return;
    if (!window.confirm('Delete this environment? This cannot be undone.')) {
      return;
    }
    try {
      await EnvironmentService.delete(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete environment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environments</h1>
          <p className="text-sm text-gray-500">
            Manage your dbt environments.
          </p>
        </div>
        {isDeveloperOrAdmin && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent/90"
          >
            New Environment
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && form && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Create Environment' : 'Edit Environment'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={e => handleFormChange('name', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={form.description || ''}
                onChange={e => handleFormChange('description', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">dbt Target Name</label>
              <input
                type="text"
                value={form.dbt_target_name || ''}
                onChange={e => handleFormChange('dbt_target_name', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Variables (JSON)</label>
              <textarea
                value={form.variables ? JSON.stringify(form.variables, null, 2) : ''}
                onChange={e => {
                  try {
                    handleFormChange('variables', JSON.parse(e.target.value));
                  } catch {
                    // ignore parse error
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm font-mono"
                rows={5}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setMode('list')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent/90 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">dbt Target</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {environments.map(env => (
                <tr key={env.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{env.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{env.description}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{env.dbt_target_name}</td>
                  <td className="px-4 py-2 text-right text-sm">
                    {isDeveloperOrAdmin && (
                      <div className="space-x-2">
                        <button onClick={() => handleEditClick(env)} className="text-accent hover:underline">Edit</button>
                        <button onClick={() => handleDelete(env.id)} className="text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {environments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                    No environments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EnvironmentsPage;