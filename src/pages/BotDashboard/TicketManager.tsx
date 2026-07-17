import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../config/supabaseClient';
import TicketPreview from './TicketPreview';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── API Helper ───────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseFields = (modalFields: string): Field[] => {
  try { return JSON.parse(modalFields || '[]'); } catch { return []; }
};

// ── Component ────────────────────────────────────────────────────────────────

const TicketManager: React.FC = () => {
  const [configs, setConfigs] = useState<TicketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TicketConfig | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', channel_id: '', category_id: '', staff_role_id: '',
    embed_color: '#5865F2', max_tickets_per_user: 3,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Field form
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [activeConfigId, setActiveConfigId] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState({ label: '', placeholder: '', required: true, style: 'short' });

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchConfigs = useCallback(async () => {
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
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // ── Panel Actions ──────────────────────────────────────────────────────────

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Nome obbligatorio';
    if (!editing && !form.channel_id) errors.channel_id = 'Channel ID obbligatorio';
    if (form.max_tickets_per_user < 1) errors.max = 'Minimo 1';
    if (form.max_tickets_per_user > 50) errors.max = 'Massimo 50';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setSaving(true);
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
      setFormErrors({});
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (id: number, name: string) => {
    if (!confirm(`Eliminare il pannello "${name}"?\n\nQuesta azione è irreversibile.`)) return;
    try {
      await botFetch(`/ticket-configs/${id}`, { method: 'DELETE' });
      setExpandedId(null);
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  // ── Field Actions ──────────────────────────────────────────────────────────

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
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  const handleRemoveField = async (configId: number, index: number) => {
    try {
      await botFetch(`/ticket-configs/${configId}/fields/${index}`, { method: 'DELETE' });
      fetchConfigs();
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
  };

  // ── Form Helpers ───────────────────────────────────────────────────────────

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
    setFormErrors({});
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditing(null);
    setForm({
      name: '', description: '', channel_id: '', category_id: '', staff_role_id: '',
      embed_color: '#5865F2', max_tickets_per_user: 3,
    });
    setFormErrors({});
    setShowForm(true);
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          <p className="text-on-surface-variant text-sm">Caricamento pannelli...</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container-high p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <span className="material-symbols-outlined text-4xl text-error">error</span>
          <p className="text-error font-bold">❌ {error}</p>
          <button onClick={fetchConfigs}
            className="rounded-xl border-[3px] border-black bg-tertiary px-6 py-2 font-label-caps text-[12px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            🔄 RIPROVA
          </button>
        </div>
      </div>
    );
  }

  // ── Empty State: Onboarding Wizard ─────────────────────────────────────────

  const emptyState = (
    <div>
      <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-5xl text-primary-container">confirmation_number</span>
          <h3 className="font-headline-md text-[22px] text-white mt-3">Nessun pannello configurato</h3>
          <p className="text-on-surface-variant mt-2 max-w-md mx-auto">
            I pannelli ticket permettono ai membri di aprire ticket personalizzati con campi specifici. Segui i passaggi qui sotto per crearne uno.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[
            {
              step: '1',
              icon: 'edit_square',
              title: 'Crea il pannello',
              desc: 'Scegli un nome, una descrizione e il canale dove apparirà il dropdown.',
            },
            {
              step: '2',
              icon: 'playlist_add',
              title: 'Aggiungi i campi',
              desc: 'Configura i campi del form: IGN, motivo del ticket, priorità, ecc.',
            },
            {
              step: '3',
              icon: 'preview',
              title: 'Anteprima e pubblica',
              desc: 'Vedi come apparirà su Discord e attiva il pannello.',
            },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border-[3px] border-black bg-surface-container p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black bg-tertiary text-black font-headline-md text-[14px]">
                  {s.step}
                </span>
                <span className="material-symbols-outlined text-primary-container text-xl">{s.icon}</span>
              </div>
              <h4 className="font-headline-md text-[16px] text-white">{s.title}</h4>
              <p className="text-xs text-on-surface-variant mt-1">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button onClick={openNewForm}
            className="rounded-xl border-[3px] border-black bg-tertiary px-8 py-3 font-label-caps text-[14px] text-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none">
            <span className="material-symbols-outlined mr-2 inline-block text-[20px]">add</span>
            CREA IL TUO PRIMO PANNELLO
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main UI ────────────────────────────────────────────────────────────────

  const previewFields = editing
    ? parseFields(editing.modal_fields)
    : (activeConfigId ? parseFields(configs.find(c => c.id === activeConfigId)?.modal_fields || '[]') : []);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-headline-md text-[28px] text-white">🎫 Pannelli Ticket</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {configs.length} pannell{configs.length !== 1 ? 'i' : 'o'} configurat{configs.length !== 1 ? 'i' : 'o'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchConfigs}
            className="rounded-xl border-[3px] border-black bg-surface-bright px-4 py-2 font-label-caps text-[11px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
            <span className="material-symbols-outlined mr-1 inline-block text-[16px]">refresh</span>
            AGGIORNA
          </button>
          <button onClick={openNewForm}
            className="rounded-xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-[11px] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
            <span className="material-symbols-outlined mr-1 inline-block text-[16px]">add</span>
            NUOVO
          </button>
        </div>
      </div>

      {/* ── Create/Edit Form Modal ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[5vh] overflow-y-auto">
          <div className="w-full max-w-5xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Form */}
              <form onSubmit={handleSaveConfig}
                className="rounded-2xl border-[4px] border-black bg-surface-container-high p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-y-auto">
                <h3 className="font-headline-md text-[24px] text-white mb-6">
                  {editing ? '✏️ Modifica Pannello' : '🆕 Nuovo Pannello Ticket'}
                </h3>

                {/* Section: Info Base */}
                <div className="mb-6">
                  <p className="font-label-caps text-[11px] text-primary-container mb-3">INFORMAZIONI BASE</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                        Nome del pannello <span className="text-error">*</span>
                      </label>
                      <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="es. Supporto Generale, Bug Report, Reclami..."
                        className={`w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                          formErrors.name ? 'border-error' : ''
                        }`} />
                      {formErrors.name && <p className="text-error text-xs mt-1">{formErrors.name}</p>}
                    </div>

                    <div>
                      <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                        Descrizione <span className="text-on-surface-variant/50">(opzionale)</span>
                      </label>
                      <input type="text" value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        placeholder="es. Per richieste di assistenza generale..."
                        className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                    </div>

                    {!editing && (
                      <div>
                        <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                          Channel ID <span className="text-error">*</span>
                        </label>
                        <input type="text" value={form.channel_id}
                          onChange={e => setForm({...form, channel_id: e.target.value})}
                          placeholder="ID del canale Discord dove apparirà il dropdown..."
                          className={`w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                            formErrors.channel_id ? 'border-error' : ''
                          }`} />
                        {formErrors.channel_id && <p className="text-error text-xs mt-1">{formErrors.channel_id}</p>}
                        <p className="text-[10px] text-on-surface-variant/50 mt-1">
                          💡 Attiva la Modalità Sviluppatore su Discord (Impostazioni → Avanzate) e copia l'ID del canale
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Aspetto */}
                <div className="mb-6">
                  <p className="font-label-caps text-[11px] text-primary-container mb-3">ASPETTO</p>
                  <div>
                    <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                      Colore embed
                    </label>
                    <div className="flex gap-3 items-center">
                      <div className="relative">
                        <input type="color" value={form.embed_color}
                          onChange={e => setForm({...form, embed_color: e.target.value})}
                          className="absolute inset-0 opacity-0 w-12 h-12 cursor-pointer" />
                        <div className="w-12 h-12 rounded-xl border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                          style={{ backgroundColor: form.embed_color }} />
                      </div>
                      <input type="text" value={form.embed_color}
                        onChange={e => setForm({...form, embed_color: e.target.value})}
                        placeholder="#5865F2"
                        className="w-32 rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                      <div className="flex gap-1">
                        {['#5865F2', '#57F287', '#FEE75C', '#ED4245', '#EB459E'].map(c => (
                          <button key={c} type="button" onClick={() => setForm({...form, embed_color: c})}
                            className="w-7 h-7 rounded-lg border-2 border-black transition-transform hover:scale-110"
                            style={{ backgroundColor: c, boxShadow: form.embed_color === c ? '0 0 0 2px white' : '' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Impostazioni */}
                <div className="mb-6">
                  <p className="font-label-caps text-[11px] text-primary-container mb-3">IMPOSTAZIONI</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                        Category ID <span className="text-on-surface-variant/50">(opzionale)</span>
                      </label>
                      <input type="text" value={form.category_id}
                        onChange={e => setForm({...form, category_id: e.target.value})}
                        placeholder="ID categoria Discord..."
                        className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                    </div>
                    <div>
                      <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                        Staff Role ID <span className="text-on-surface-variant/50">(opzionale)</span>
                      </label>
                      <input type="text" value={form.staff_role_id}
                        onChange={e => setForm({...form, staff_role_id: e.target.value})}
                        placeholder="ID ruolo staff..."
                        className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                    </div>
                    <div>
                      <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                        Max ticket per utente
                      </label>
                      <input type="number" value={form.max_tickets_per_user} min={1} max={50}
                        onChange={e => setForm({...form, max_tickets_per_user: parseInt(e.target.value) || 3})}
                        className={`w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                          formErrors.max ? 'border-error' : ''
                        }`} />
                      {formErrors.max && <p className="text-error text-xs mt-1">{formErrors.max}</p>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="rounded-xl border-[3px] border-black bg-primary-container px-6 py-2.5 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? '⏳ SALVATAGGIO...' : '💾 SALVA'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); setFormErrors({}); }}
                    className="rounded-xl border-[3px] border-black bg-surface-bright px-6 py-2.5 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    ANNULLA
                  </button>
                </div>
              </form>

              {/* Preview Panel */}
              <div className="hidden lg:block">
                <p className="font-label-caps text-[11px] text-on-surface-variant mb-2 ml-1">ANTEPRIMA DISCORD</p>
                <div className="sticky top-4">
                  <TicketPreview
                    name={form.name}
                    description={form.description}
                    embedColor={form.embed_color}
                    fields={previewFields}
                    channelName={editing ? `#canale-${editing.channel_id}` : (form.channel_id ? `#canale-${form.channel_id}` : undefined)}
                    isDraft
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Field Form Modal ────────────────────────────────────────────────── */}
      {showFieldForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAddField}
            className="w-full max-w-sm rounded-2xl border-[4px] border-black bg-surface-container-high p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-headline-md text-[20px] text-white mb-4">➕ Aggiungi Campo al Form</h3>
            <div className="space-y-3">
              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                  Etichetta <span className="text-error">*</span>
                </label>
                <input type="text" value={fieldForm.label}
                  onChange={e => setFieldForm({...fieldForm, label: e.target.value})}
                  placeholder="es. IGN, Email, Motivo..."
                  required
                  className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              </div>
              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">
                  Placeholder
                </label>
                <input type="text" value={fieldForm.placeholder}
                  onChange={e => setFieldForm({...fieldForm, placeholder: e.target.value})}
                  placeholder="Testo di esempio nel campo..."
                  className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">Tipo</label>
                  <select value={fieldForm.style}
                    onChange={e => setFieldForm({...fieldForm, style: e.target.value})}
                    className="w-full rounded-xl border-[3px] border-black bg-surface-container px-3 py-2.5 text-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <option value="short">📄 Breve (1 riga)</option>
                    <option value="long">📝 Lungo (paragrafo)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1">Obbligatorio?</label>
                  <div className="flex gap-2 mt-1">
                    <button type="button"
                      onClick={() => setFieldForm({...fieldForm, required: true})}
                      className={`flex-1 rounded-lg border-2 border-black px-3 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                        fieldForm.required ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                      ✅ Sì
                    </button>
                    <button type="button"
                      onClick={() => setFieldForm({...fieldForm, required: false})}
                      className={`flex-1 rounded-lg border-2 border-black px-3 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                        !fieldForm.required ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                      ⬜ No
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="submit"
                className="rounded-xl border-[3px] border-black bg-primary-container px-5 py-2.5 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                AGGIUNGI
              </button>
              <button type="button" onClick={() => setShowFieldForm(false)}
                className="rounded-xl border-[3px] border-black bg-surface-bright px-5 py-2.5 font-label-caps text-[12px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                ANNULLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content: Empty state or Panel List */}
      {configs.length === 0 ? emptyState : (
        <div className="space-y-3">
        {configs.map((config) => {
          const fields = parseFields(config.modal_fields);
          const isExpanded = expandedId === config.id;
          const isActive = config.active !== 0;

          return (
            <div key={config.id}
              className={`rounded-2xl border-[3px] border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all ${
                isActive ? 'bg-surface-container-high' : 'bg-surface-container opacity-60'
              }`}>
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Color & Status indicator */}
                  <div className="relative">
                    <div className="h-5 w-5 rounded-full border-2 border-black"
                      style={{ backgroundColor: config.embed_color || '#5865F2' }} />
                    {!isActive && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-error border border-black" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-headline-md text-[18px] text-white truncate">{config.name}</h4>
                      {!isActive && (
                        <span className="rounded-md border border-black bg-error-container px-1.5 py-0.5 text-[9px] font-bold text-on-error-container">
                          DISATTIVO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>🆔 ID: {config.id}</span>
                      <span>📺 Canale: {config.channel_id}</span>
                      <span>📋 {fields.length} camp{fields.length !== 1 ? 'i' : 'o'}</span>
                      <span>👤 Max: {config.max_tickets_per_user} ticket</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setExpandedId(isExpanded ? null : config.id)}
                    className="rounded-lg border-2 border-black bg-surface-bright p-2 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                    title={isExpanded ? 'Chiudi dettagli' : 'Espandi dettagli'}>
                    <span className="material-symbols-outlined text-[18px]">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  <button onClick={() => openEditForm(config)}
                    className="rounded-lg border-2 border-black bg-tertiary p-2 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                    title="Modifica pannello">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button onClick={() => handleDeleteConfig(config.id, config.name)}
                    className="rounded-lg border-2 border-black bg-error-container p-2 text-on-error-container shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                    title="Elimina pannello">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Expanded: Fields + Preview */}
              {isExpanded && (
                <div className="border-t-2 border-black/20 px-4 pb-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_340px] pt-4">
                    {/* Fields List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-label-caps text-[12px] text-on-surface-variant">
                          CAMPI DEL FORM ({fields.length}/5)
                        </p>
                        <button
                          onClick={() => { setActiveConfigId(config.id); setShowFieldForm(true); }}
                          disabled={fields.length >= 5}
                          className="rounded-lg border-2 border-black bg-tertiary px-3 py-1.5 font-label-caps text-[10px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                          + AGGIUNGI CAMPO
                        </button>
                      </div>

                      {fields.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-black/30 bg-surface-container p-6 text-center">
                          <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">playlist_add</span>
                          <p className="text-sm text-on-surface-variant mt-2">
                            Nessun campo configurato.
                          </p>
                          <p className="text-xs text-on-surface-variant/60 mt-1">
                            I campi appariranno nel modal che l'utente compila per aprire il ticket.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {fields.map((field, idx) => (
                            <div key={idx}
                              className="flex items-center justify-between rounded-lg border-2 border-black bg-surface-container p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-on-surface-variant/40 w-5">{idx + 1}.</span>
                                <div className="min-w-0">
                                  <span className="text-sm font-bold text-white">{field.label}</span>
                                  <span className="text-xs text-on-surface-variant ml-2">
                                    {field.style === 'long' ? '📝 Lungo' : '📄 Breve'}
                                    {' · '}
                                    {field.required ? '✅ Obbligatorio' : '⬜ Opzionale'}
                                  </span>
                                </div>
                              </div>
                              <button onClick={() => handleRemoveField(config.id, idx)}
                                className="rounded-lg border-2 border-black bg-error-container px-2 py-1 text-xs text-on-error-container shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all flex-shrink-0"
                                title="Rimuovi campo">
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {fields.length >= 5 && (
                        <p className="text-[10px] text-error mt-2">
                          ⚠️ Limite massimo di 5 campi raggiunto (limite imposto da Discord).
                        </p>
                      )}
                    </div>

                    {/* Mini Preview */}
                    <div className="hidden lg:block">
                      <p className="font-label-caps text-[11px] text-on-surface-variant mb-2">ANTEPRIMA</p>
                      <TicketPreview
                        name={config.name}
                        description={config.description || ''}
                        embedColor={config.embed_color || '#5865F2'}
                        fields={fields}
                        channelName={`#canale-${config.channel_id}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};

export default TicketManager;
