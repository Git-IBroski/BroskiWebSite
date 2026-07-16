import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

interface TicketConfig {
  id: number;
  name: string;
  channel_id: number;
  description: string;
  category_id: number | null;
  staff_role_id: number | null;
  modal_fields: string;
  embed_color: string;
  max_tickets_per_user: number;
  active: number;
}

interface Field {
  label: string;
  placeholder: string;
  required: boolean;
  style: string;
}

const botFetch = async (path: string, options?: RequestInit) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non autenticato');
  const resp = await fetch(`/api/bot-admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options?.headers,
    },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.detail || 'Errore');
  return data;
};

const TicketManager: React.FC = () => {
  const [configs, setConfigs] = useState<TicketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [fields, setFields] = useState<Record<number, Field[]>>({});

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TicketConfig | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', channel_id: '', category_id: '', staff_role_id: '',
    embed_color: '#5865F2', max_tickets_per_user: 3,
  });

  // Field form
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [activeConfigId, setActiveConfigId] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState({ label: '', placeholder: '', required: true, style: 'short' });

  const fetchConfigs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await botFetch('/ticket-configs');
      setConfigs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const fetchFields = async (configId: number) => {
    try {
      const config = configs.find(c => c.id === configId);
      if (!config) return;
      const fields = JSON.parse(config.modal_fields || '[]');
      setFields(prev => ({ ...prev, [configId]: fields }));
    } catch {
      setFields(prev => ({ ...prev, [configId]: [] }));
    }
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!fields[id]) fetchFields(id);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await botFetch(`/ticket-configs/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name || undefined,
            description: form.description || undefined,
            category_id: form.category_id ? parseInt(form.category_id) : undefined,
            staff_role_id: form.staff_role_id ? parseInt(form.staff_role_id) : undefined,
            embed_color: form.embed_color || undefined,
            max_tickets_per_user: form.max_tickets_per_user,
          }),
        });
      } else {
        await botFetch('/ticket-configs', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            channel_id: parseInt(form.channel_id),
            description: form.description,
            category_id: form.category_id ? parseInt(form.category_id) : null,
            staff_role_id: form.staff_role_id ? parseInt(form.staff_role_id) : null,
            embed_color: form.embed_color,
            max_tickets_per_user: form.max_tickets_per_user,
          }),
        });
      }
      setShowForm(false);
      setEditing(null);
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  const handleDeleteConfig = async (id: number) => {
    if (!confirm('Eliminare questo pannello?')) return;
    try {
      await botFetch(`/ticket-configs/${id}`, { method: 'DELETE' });
      setExpandedId(null);
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConfigId) return;
    try {
      await botFetch(`/ticket-configs/${activeConfigId}/fields`, {
        method: 'POST',
        body: JSON.stringify(fieldForm),
      });
      setShowFieldForm(false);
      setFieldForm({ label: '', placeholder: '', required: true, style: 'short' });
      fetchFields(activeConfigId);
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  const handleRemoveField = async (configId: number, index: number) => {
    try {
      await botFetch(`/ticket-configs/${configId}/fields/${index}`, { method: 'DELETE' });
      fetchFields(configId);
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  const openEditForm = (config: TicketConfig) => {
    setEditing(config);
    setForm({
      name: config.name,
      description: config.description || '',
      channel_id: String(config.channel_id),
      category_id: config.category_id ? String(config.category_id) : '',
      staff_role_id: config.staff_role_id ? String(config.staff_role_id) : '',
      embed_color: config.embed_color || '#5865F2',
      max_tickets_per_user: config.max_tickets_per_user || 3,
    });
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditing(null);
    setForm({
      name: '', description: '', channel_id: '', category_id: '', staff_role_id: '',
      embed_color: '#5865F2', max_tickets_per_user: 3,
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-headline-md text-[28px] text-white">🎫 Pannelli Ticket</h2>
        <button
          onClick={openNewForm}
          className="rounded-xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-[12px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
        >
          <span className="material-symbols-outlined mr-1 inline-block text-[18px]">add</span>
          NUOVO PANNELLO
        </button>
      </div>

      {error && (
        <div className="text-center py-4">
          <p className="text-error font-bold mb-2">❌ {error}</p>
          <button onClick={fetchConfigs} className="rounded-xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-[11px] text-black">RIPROVA</button>
        </div>
      )}

      {/* Form modale */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveConfig} className="w-full max-w-lg rounded-2xl border-[4px] border-black bg-surface-container-high p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline-md text-[22px] text-white mb-4">
              {editing ? '✏️ Modifica Pannello' : '🆕 Nuovo Pannello'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="font-label-caps text-[11px] text-on-surface-variant">Nome *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                  className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              </div>
              <div>
                <label className="font-label-caps text-[11px] text-on-surface-variant">Descrizione</label>
                <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              </div>
              {!editing && (
                <div>
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Channel ID *</label>
                  <input type="text" value={form.channel_id} onChange={e => setForm({...form, channel_id: e.target.value})} required
                    className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Categoria ID</label>
                  <input type="text" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
                    className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                </div>
                <div>
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Staff Role ID</label>
                  <input type="text" value={form.staff_role_id} onChange={e => setForm({...form, staff_role_id: e.target.value})}
                    className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Colore</label>
                  <div className="flex gap-2">
                    <input type="color" value={form.embed_color} onChange={e => setForm({...form, embed_color: e.target.value})}
                      className="h-10 w-10 rounded-lg border-2 border-black cursor-pointer" />
                    <input type="text" value={form.embed_color} onChange={e => setForm({...form, embed_color: e.target.value})}
                      className="flex-1 rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                  </div>
                </div>
                <div>
                  <label className="font-label-caps text-[11px] text-on-surface-variant">Max Ticket/Utente</label>
                  <input type="number" value={form.max_tickets_per_user} onChange={e => setForm({...form, max_tickets_per_user: parseInt(e.target.value) || 3})}
                    className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="submit" className="rounded-xl border-[3px] border-black bg-primary-container px-6 py-2 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                SALVA
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-xl border-[3px] border-black bg-surface-bright px-6 py-2 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                ANNULLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Field form modale */}
      {showFieldForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAddField} className="w-full max-w-sm rounded-2xl border-[4px] border-black bg-surface-container-high p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-headline-md text-[20px] text-white mb-4">➕ Aggiungi Campo</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Etichetta (es. IGN)" value={fieldForm.label} onChange={e => setFieldForm({...fieldForm, label: e.target.value})} required
                className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              <input type="text" placeholder="Placeholder" value={fieldForm.placeholder} onChange={e => setFieldForm({...fieldForm, placeholder: e.target.value})}
                className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              <div className="flex gap-3">
                <select value={fieldForm.style} onChange={e => setFieldForm({...fieldForm, style: e.target.value})}
                  className="flex-1 rounded-xl border-[3px] border-black bg-surface-container px-3 py-2 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <option value="short">Breve (1 riga)</option>
                  <option value="long">Lungo (paragrafo)</option>
                </select>
                <label className="flex items-center gap-2 font-label-caps text-[11px] text-on-surface-variant">
                  <input type="checkbox" checked={fieldForm.required} onChange={e => setFieldForm({...fieldForm, required: e.target.checked})}
                    className="h-4 w-4" />
                  Obbligatorio
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="submit" className="rounded-xl border-[3px] border-black bg-primary-container px-6 py-2 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">AGGIUNGI</button>
              <button type="button" onClick={() => setShowFieldForm(false)}
                className="rounded-xl border-[3px] border-black bg-surface-bright px-6 py-2 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">ANNULLA</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista pannelli */}
      {configs.length === 0 && !error && (
        <p className="text-center py-8 text-on-surface-variant">Nessun pannello ticket configurato.</p>
      )}

      <div className="space-y-3">
        {configs.map((config) => (
          <div key={config.id} className="rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full border-2 border-black" style={{ backgroundColor: config.embed_color || '#5865F2' }} />
                <div>
                  <h4 className="font-headline-md text-[18px] text-white">{config.name}</h4>
                  <p className="text-xs text-on-surface-variant">ID: {config.id} • Canale: {config.channel_id} • Max: {config.max_tickets_per_user} ticket</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleExpand(config.id)}
                  className="rounded-lg border-2 border-black bg-surface-bright p-2 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-[18px]">{expandedId === config.id ? 'expand_less' : 'expand_more'}</span>
                </button>
                <button onClick={() => openEditForm(config)}
                  className="rounded-lg border-2 border-black bg-tertiary p-2 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => handleDeleteConfig(config.id)}
                  className="rounded-lg border-2 border-black bg-error-container p-2 text-on-error-container shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>

            {/* Expanded: campi form */}
            {expandedId === config.id && (
              <div className="mt-4 pt-4 border-t-2 border-black/20">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-label-caps text-[12px] text-on-surface-variant">CAMPI FORM ({fields[config.id]?.length || 0}/5)</p>
                  <button onClick={() => { setActiveConfigId(config.id); setShowFieldForm(true); }}
                    className="rounded-lg border-2 border-black bg-tertiary px-3 py-1 font-label-caps text-[10px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    + AGGIUNGI
                  </button>
                </div>
                {(!fields[config.id] || fields[config.id].length === 0) ? (
                  <p className="text-xs text-on-surface-variant py-2">Nessun campo. Aggiungi il primo!</p>
                ) : (
                  <div className="space-y-2">
                    {fields[config.id]?.map((field, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border-2 border-black bg-surface-container p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div>
                          <span className="text-sm font-bold text-white">{field.label}</span>
                          <span className="text-xs text-on-surface-variant ml-2">
                            {field.style === 'long' ? '📝 Lungo' : '📄 Breve'} • {field.required ? '✅' : '⬜'}
                          </span>
                        </div>
                        <button onClick={() => handleRemoveField(config.id, idx)}
                          className="rounded border-2 border-black bg-error-container px-2 py-0.5 text-xs text-on-error-container shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketManager;
