'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  is_public: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Setting[]>('/admin/settings')
      .then(setSettings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(s: Setting) {
    setSaving(s.id);
    const newVal = editing[s.id] ?? s.value;
    try {
      await api.post(`/admin/settings/${s.key}`, { value: newVal });
      setSettings((prev) => prev.map((x) => x.id === s.id ? { ...x, value: newVal } : x));
      setEditing((prev) => { const next = { ...prev }; delete next[s.id]; return next; });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
            <p className="text-xs text-gray-400 mt-0.5">Edit system-level settings. Changes take effect immediately.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {settings.map((s) => {
              const isDirty = editing[s.id] !== undefined && editing[s.id] !== s.value;
              return (
                <div key={s.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{s.key}</p>
                    {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input                      aria-label={s.key}
                      title={s.key}
                      placeholder={s.value}                      className="w-56 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={editing[s.id] ?? s.value}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    />
                    {isDirty && (
                      <button
                        onClick={() => handleSave(s)}
                        disabled={saving === s.id}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                      >
                        {saving === s.id ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {settings.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">No settings configured</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
