import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import { SMP_QUESTION_TYPES } from './smpTypes';
import type { SmpApplication, SmpInfo, SmpPlugin, SmpQuestion, SmpQuestionType, Lang } from './smpTypes';

type Panel = 'info' | 'plugins' | 'questions' | 'applications';

const card = 'rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]';
const input =
  'w-full rounded-xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-white placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none';
const btn =
  'flex items-center gap-2 rounded-2xl border-[3px] border-black px-5 py-3 font-headline-md text-[15px] uppercase tracking-tighter shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none';
const label = 'mb-1 block font-label-caps text-[11px] uppercase text-on-surface-variant';

// Plugin/question form drafts carry both languages plus the newline-joined option editors.
type PluginDraft = Partial<SmpPlugin>;
type QuestionDraft = Partial<SmpQuestion> & { optionsText?: string; optionsTextEn?: string };

const emptyPlugin: PluginDraft = { name: '', name_en: '', description: '', description_en: '', icon: '', sort_order: 0 };
const emptyQuestion: QuestionDraft = {
  label: '', label_en: '', helper: '', helper_en: '', type: 'text',
  required: true, sort_order: 0, active: true, optionsText: '', optionsTextEn: '', url_prefix: '',
};

const SmpAdminSection: React.FC = () => {
  const [panel, setPanel] = useState<Panel>('info');
  // Which language's fields the admin is currently editing.
  const [lang, setLang] = useState<Lang>('it');

  // Info
  const [info, setInfo] = useState<SmpInfo | null>(null);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  // Plugins
  const [plugins, setPlugins] = useState<SmpPlugin[]>([]);
  const [pluginForm, setPluginForm] = useState<PluginDraft>(emptyPlugin);
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);

  // Questions
  const [questions, setQuestions] = useState<SmpQuestion[]>([]);
  const [qForm, setQForm] = useState<QuestionDraft>(emptyQuestion);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

  // Applications
  const [apps, setApps] = useState<SmpApplication[]>([]);

  const loadAll = useCallback(async () => {
    const [{ data: infoData }, { data: pluginData }, { data: qData }, { data: appData }] = await Promise.all([
      supabase.from('smp_info').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('smp_plugins').select('*').order('sort_order', { ascending: true }),
      supabase.from('smp_application_questions').select('*').order('sort_order', { ascending: true }),
      supabase.from('smp_applications').select('*').order('created_at', { ascending: false }),
    ]);
    setInfo((infoData as SmpInfo) ?? {
      id: '', hero_title: 'BroskiSMP', hero_title_en: '', hero_subtitle: '', hero_subtitle_en: '',
      about: '', about_en: '', rules: '', rules_en: '',
      discord_url: '', applications_open: true, updated_at: null,
    });
    setPlugins((pluginData as SmpPlugin[]) ?? []);
    setQuestions((qData as SmpQuestion[]) ?? []);
    setApps((appData as SmpApplication[]) ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Language toggle shown at the top of the content panels.
  const langToggle = (
    <div className="inline-flex items-center gap-1 rounded-xl border-[3px] border-black bg-black p-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
      {(['it', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-lg px-4 py-2 font-label-caps text-[12px] uppercase transition-all ${lang === l ? 'bg-tertiary text-black' : 'text-white hover:bg-white/10'}`}
        >
          {l === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English'}
        </button>
      ))}
    </div>
  );

  // ---- Info ----
  const saveInfo = async () => {
    if (!info) return;
    setInfoSaving(true);
    const payload = {
      hero_title: info.hero_title,
      hero_title_en: info.hero_title_en,
      hero_subtitle: info.hero_subtitle,
      hero_subtitle_en: info.hero_subtitle_en,
      about: info.about,
      about_en: info.about_en,
      rules: info.rules,
      rules_en: info.rules_en,
      discord_url: info.discord_url,
      applications_open: info.applications_open,
      updated_at: new Date().toISOString(),
    };
    const { error } = info.id
      ? await supabase.from('smp_info').update(payload).eq('id', info.id)
      : await supabase.from('smp_info').insert(payload);
    setInfoSaving(false);
    if (!error) {
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
      loadAll();
    } else {
      alert(error.message);
    }
  };

  // Bind an info field to either the IT (base) or EN (_en) column based on the toggle.
  const infoVal = (base: keyof SmpInfo, en: keyof SmpInfo) => String((lang === 'it' ? info?.[base] : info?.[en]) ?? '');
  const setInfoVal = (base: keyof SmpInfo, en: keyof SmpInfo, value: string) =>
    setInfo((prev) => (prev ? { ...prev, [lang === 'it' ? base : en]: value } : prev));

  // ---- Plugins ----
  const resetPluginForm = () => { setPluginForm(emptyPlugin); setEditingPlugin(null); };
  const savePlugin = async () => {
    if (!pluginForm.name?.trim()) { alert('Il nome (IT) del plugin è obbligatorio'); return; }
    const payload = {
      name: pluginForm.name,
      name_en: pluginForm.name_en || null,
      description: pluginForm.description || null,
      description_en: pluginForm.description_en || null,
      icon: pluginForm.icon || null,
      sort_order: pluginForm.sort_order ?? 0,
    };
    const { error } = editingPlugin
      ? await supabase.from('smp_plugins').update(payload).eq('id', editingPlugin)
      : await supabase.from('smp_plugins').insert(payload);
    if (error) { alert(error.message); return; }
    resetPluginForm();
    loadAll();
  };
  const editPlugin = (p: SmpPlugin) => { setPluginForm(p); setEditingPlugin(p.id); };
  const deletePlugin = async (id: string) => {
    if (!confirm('Eliminare questo plugin?')) return;
    await supabase.from('smp_plugins').delete().eq('id', id);
    loadAll();
  };

  // ---- Questions ----
  const needsOptions = (t?: SmpQuestionType) => t === 'multiple_choice' || t === 'checkbox';
  const resetQForm = () => { setQForm(emptyQuestion); setEditingQuestion(null); };
  const saveQuestion = async () => {
    if (!qForm.label?.trim()) { alert('La domanda (IT) è obbligatoria'); return; }
    const options = needsOptions(qForm.type)
      ? (qForm.optionsText || '').split('\n').map((s) => s.trim()).filter(Boolean)
      : [];
    const options_en = needsOptions(qForm.type)
      ? (qForm.optionsTextEn || '').split('\n').map((s) => s.trim()).filter(Boolean)
      : [];
    if (needsOptions(qForm.type) && options.length === 0) { alert('Aggiungi almeno un\'opzione (IT), una per riga'); return; }
    const payload = {
      label: qForm.label,
      label_en: qForm.label_en || null,
      helper: qForm.helper || null,
      helper_en: qForm.helper_en || null,
      type: qForm.type as SmpQuestionType,
      options,
      options_en,
      url_prefix: qForm.type === 'url' ? (qForm.url_prefix?.trim() || null) : null,
      required: qForm.required ?? true,
      sort_order: qForm.sort_order ?? 0,
      active: qForm.active ?? true,
    };
    const { error } = editingQuestion
      ? await supabase.from('smp_application_questions').update(payload).eq('id', editingQuestion)
      : await supabase.from('smp_application_questions').insert(payload);
    if (error) { alert(error.message); return; }
    resetQForm();
    loadAll();
  };
  const editQuestion = (q: SmpQuestion) => {
    setQForm({ ...q, optionsText: (q.options || []).join('\n'), optionsTextEn: (q.options_en || []).join('\n') });
    setEditingQuestion(q.id);
  };
  const deleteQuestion = async (id: string) => {
    if (!confirm('Eliminare questa domanda?')) return;
    await supabase.from('smp_application_questions').delete().eq('id', id);
    loadAll();
  };

  // ---- Applications ----
  const updateApp = async (id: string, patch: Partial<SmpApplication>) => {
    await supabase.from('smp_applications').update(patch).eq('id', id);
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const deleteApp = async (id: string) => {
    if (!confirm('Eliminare questa candidatura?')) return;
    await supabase.from('smp_applications').delete().eq('id', id);
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  const tabBtn = (p: Panel, icon: string, text: string) => (
    <button
      onClick={() => setPanel(p)}
      className={`rounded-xl border-[3px] border-black px-4 py-2 font-headline-md text-[14px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
        panel === p ? 'bg-primary-container text-white' : 'bg-surface-container-high text-on-surface hover:-translate-y-0.5'
      }`}
    >
      <span className="material-symbols-outlined mr-1 inline-block text-[18px] align-middle">{icon}</span>
      {text}
    </button>
  );

  // Suffix marking which lang a field belongs to (shown in field labels).
  const lt = lang === 'it' ? 'IT' : 'EN';

  return (
    <div className={card}>
      <div className="mb-6 flex items-center gap-3">
        <span className="material-symbols-outlined rounded-2xl border-[3px] border-black bg-primary-container p-2 text-[26px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">public</span>
        <h2 className="font-headline-md text-[28px] text-white">BroskiSMP</h2>
      </div>

      {/* Sub-tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabBtn('info', 'info', 'Info')}
        {tabBtn('plugins', 'extension', 'Plugins')}
        {tabBtn('questions', 'quiz', 'Domande')}
        {tabBtn('applications', 'inbox', `Candidature${apps.length ? ` (${apps.length})` : ''}`)}
      </div>

      {/* Language toggle (not shown on Applications, which are read-only snapshots) */}
      {panel !== 'applications' && (
        <div className="mb-6 flex items-center gap-3">
          {langToggle}
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Stai modificando i contenuti in <strong className="text-white">{lang === 'it' ? 'Italiano' : 'Inglese'}</strong>.
            {lang === 'en' && ' Se lasci vuoto, verrà mostrato il testo italiano.'}
          </span>
        </div>
      )}

      {/* INFO PANEL */}
      {panel === 'info' && info !== null && (
        <div className="flex flex-col gap-4">
          <div>
            <label className={label}>Titolo hero ({lt})</label>
            <input className={input} value={infoVal('hero_title', 'hero_title_en')} onChange={(e) => setInfoVal('hero_title', 'hero_title_en', e.target.value)} />
          </div>
          <div>
            <label className={label}>Sottotitolo hero ({lt})</label>
            <input className={input} value={infoVal('hero_subtitle', 'hero_subtitle_en')} onChange={(e) => setInfoVal('hero_subtitle', 'hero_subtitle_en', e.target.value)} />
          </div>
          <div>
            <label className={label}>Chi siamo — markdown ({lt})</label>
            <textarea rows={8} className={input} value={infoVal('about', 'about_en')} onChange={(e) => setInfoVal('about', 'about_en', e.target.value)} />
          </div>
          <div>
            <label className={label}>Regole — markdown, opzionale ({lt})</label>
            <textarea rows={6} className={input} value={infoVal('rules', 'rules_en')} onChange={(e) => setInfoVal('rules', 'rules_en', e.target.value)} />
          </div>

          {/* Shared (language-independent) fields */}
          <div className="rounded-2xl border-[3px] border-dashed border-on-surface-variant/40 p-4">
            <p className="mb-3 font-label-caps text-[10px] uppercase text-on-surface-variant">Impostazioni comuni (valide per entrambe le lingue)</p>
            <div className="mb-3">
              <label className={label}>Link invito Discord</label>
              <input className={input} value={info.discord_url ?? ''} onChange={(e) => setInfo({ ...info, discord_url: e.target.value })} placeholder="https://discord.gg/…" />
            </div>
            <label className="flex items-center gap-3 font-body-sm text-white">
              <input type="checkbox" checked={info.applications_open} onChange={(e) => setInfo({ ...info, applications_open: e.target.checked })} className="h-5 w-5 accent-tertiary" />
              Candidature aperte
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveInfo} disabled={infoSaving} className={`${btn} bg-tertiary text-black disabled:opacity-60`}>
              <span className="material-symbols-outlined">save</span>
              {infoSaving ? 'Salvataggio…' : 'Salva info'}
            </button>
            {infoSaved && <span className="font-label-caps text-[12px] text-green-400">Salvato!</span>}
          </div>
        </div>
      )}

      {/* PLUGINS PANEL */}
      {panel === 'plugins' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="mb-4 font-headline-md text-[18px] text-white">{editingPlugin ? 'Modifica plugin' : 'Aggiungi plugin'}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Nome ({lt})</label>
                <input
                  className={input}
                  value={(lang === 'it' ? pluginForm.name : pluginForm.name_en) ?? ''}
                  onChange={(e) => setPluginForm({ ...pluginForm, [lang === 'it' ? 'name' : 'name_en']: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Icona (material symbol o URL immagine)</label>
                <input className={input} value={pluginForm.icon ?? ''} onChange={(e) => setPluginForm({ ...pluginForm, icon: e.target.value })} placeholder="es. shield" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Descrizione ({lt})</label>
                <textarea
                  rows={2}
                  className={input}
                  value={(lang === 'it' ? pluginForm.description : pluginForm.description_en) ?? ''}
                  onChange={(e) => setPluginForm({ ...pluginForm, [lang === 'it' ? 'description' : 'description_en']: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Ordine</label>
                <input type="number" className={input} value={pluginForm.sort_order ?? 0} onChange={(e) => setPluginForm({ ...pluginForm, sort_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={savePlugin} className={`${btn} bg-tertiary text-black`}>
                <span className="material-symbols-outlined">{editingPlugin ? 'save' : 'add'}</span>
                {editingPlugin ? 'Salva' : 'Aggiungi'}
              </button>
              {editingPlugin && (
                <button onClick={resetPluginForm} className={`${btn} bg-surface-container text-white`}>Annulla</button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {plugins.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-3">
                  {p.icon && !p.icon.startsWith('http') && <span className="material-symbols-outlined text-tertiary">{p.icon}</span>}
                  <div>
                    <p className="font-headline-md text-[16px] text-white">
                      {p.name} <span className="font-label-caps text-[10px] text-on-surface-variant">#{p.sort_order}</span>
                      {!p.name_en && <span className="ml-2 rounded bg-error-container px-2 py-0.5 font-label-caps text-[9px] text-on-error-container">EN mancante</span>}
                    </p>
                    {p.description && <p className="font-body-sm text-[13px] text-on-surface-variant">{p.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => editPlugin(p)} className="rounded-lg border-2 border-black bg-surface-container px-3 py-2 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                  <button onClick={() => deletePlugin(p.id)} className="rounded-lg border-2 border-black bg-error-container px-3 py-2 text-on-error-container shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              </div>
            ))}
            {plugins.length === 0 && <p className="py-4 text-center font-body-sm text-on-surface-variant">Nessun plugin.</p>}
          </div>
        </div>
      )}

      {/* QUESTIONS PANEL */}
      {panel === 'questions' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border-[3px] border-black bg-surface-container-high p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="mb-4 font-headline-md text-[18px] text-white">{editingQuestion ? 'Modifica domanda' : 'Aggiungi domanda'}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Domanda ({lt})</label>
                <input
                  className={input}
                  value={(lang === 'it' ? qForm.label : qForm.label_en) ?? ''}
                  onChange={(e) => setQForm({ ...qForm, [lang === 'it' ? 'label' : 'label_en']: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Testo di aiuto — opzionale ({lt})</label>
                <input
                  className={input}
                  value={(lang === 'it' ? qForm.helper : qForm.helper_en) ?? ''}
                  onChange={(e) => setQForm({ ...qForm, [lang === 'it' ? 'helper' : 'helper_en']: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Tipo</label>
                <select className={input} value={qForm.type} onChange={(e) => setQForm({ ...qForm, type: e.target.value as SmpQuestionType })}>
                  {SMP_QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Ordine</label>
                <input type="number" className={input} value={qForm.sort_order ?? 0} onChange={(e) => setQForm({ ...qForm, sort_order: Number(e.target.value) })} />
              </div>
              {needsOptions(qForm.type) && (
                <div className="sm:col-span-2">
                  <label className={label}>Opzioni ({lt}) — una per riga</label>
                  <textarea
                    rows={4}
                    className={input}
                    value={(lang === 'it' ? qForm.optionsText : qForm.optionsTextEn) ?? ''}
                    onChange={(e) => setQForm({ ...qForm, [lang === 'it' ? 'optionsText' : 'optionsTextEn']: e.target.value })}
                    placeholder={'Opzione A\nOpzione B\nOpzione C'}
                  />
                  <p className="mt-1 font-body-sm text-[11px] text-on-surface-variant">Mantieni lo stesso ordine e numero di righe tra IT ed EN.</p>
                </div>
              )}
              {qForm.type === 'url' && (
                <div className="sm:col-span-2">
                  <label className={label}>Inizio URL richiesto (comune a IT/EN)</label>
                  <input
                    className={input}
                    value={qForm.url_prefix ?? ''}
                    onChange={(e) => setQForm({ ...qForm, url_prefix: e.target.value })}
                    placeholder="es. https://www.youtube.com/@"
                  />
                  <p className="mt-1 font-body-sm text-[11px] text-on-surface-variant">
                    Il link inserito dal candidato dovrà iniziare esattamente con questo testo, altrimenti non potrà inviare la candidatura. Lascia vuoto per accettare qualsiasi URL.
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2 font-body-sm text-white">
                <input type="checkbox" checked={qForm.required ?? true} onChange={(e) => setQForm({ ...qForm, required: e.target.checked })} className="h-5 w-5 accent-tertiary" />
                Obbligatoria
              </label>
              <label className="flex items-center gap-2 font-body-sm text-white">
                <input type="checkbox" checked={qForm.active ?? true} onChange={(e) => setQForm({ ...qForm, active: e.target.checked })} className="h-5 w-5 accent-tertiary" />
                Attiva (mostrata nel form)
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={saveQuestion} className={`${btn} bg-tertiary text-black`}>
                <span className="material-symbols-outlined">{editingQuestion ? 'save' : 'add'}</span>
                {editingQuestion ? 'Salva' : 'Aggiungi'}
              </button>
              {editingQuestion && <button onClick={resetQForm} className={`${btn} bg-surface-container text-white`}>Annulla</button>}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {questions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-4 rounded-2xl border-[3px] border-black bg-surface-container-high p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div>
                  <p className="font-headline-md text-[15px] text-white">
                    {q.label} {q.required && <span className="text-red-400">*</span>}
                    {!q.active && <span className="ml-2 rounded bg-surface-container px-2 py-0.5 font-label-caps text-[9px] text-on-surface-variant">inattiva</span>}
                    {!q.label_en && <span className="ml-2 rounded bg-error-container px-2 py-0.5 font-label-caps text-[9px] text-on-error-container">EN mancante</span>}
                  </p>
                  <p className="font-label-caps text-[10px] text-on-surface-variant">
                    {SMP_QUESTION_TYPES.find((t) => t.value === q.type)?.label} • #{q.sort_order}
                    {q.options?.length > 0 && ` • ${q.options.length} opzioni`}
                    {q.type === 'url' && q.url_prefix && ` • inizia con ${q.url_prefix}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => editQuestion(q)} className="rounded-lg border-2 border-black bg-surface-container px-3 py-2 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                  <button onClick={() => deleteQuestion(q.id)} className="rounded-lg border-2 border-black bg-error-container px-3 py-2 text-on-error-container shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              </div>
            ))}
            {questions.length === 0 && <p className="py-4 text-center font-body-sm text-on-surface-variant">Nessuna domanda.</p>}
          </div>
        </div>
      )}

      {/* APPLICATIONS PANEL */}
      {panel === 'applications' && (
        <div className="flex flex-col gap-4">
          {apps.length === 0 && <p className="py-8 text-center font-body-sm text-on-surface-variant">Nessuna candidatura ricevuta.</p>}
          {apps.map((a) => (
            <div key={a.id} className="rounded-2xl border-[3px] border-black bg-surface-container-high p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-headline-md text-[16px] text-white">{a.applicant_name || 'Sconosciuto'}</p>
                  <p className="font-label-caps text-[9px] text-on-surface-variant/60">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={a.status}
                    onChange={(e) => updateApp(a.id, { status: e.target.value as SmpApplication['status'] })}
                    className={`rounded-lg border-2 border-black px-3 py-2 font-label-caps text-[11px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      a.status === 'accepted' ? 'bg-green-600 text-white' : a.status === 'rejected' ? 'bg-error-container text-on-error-container' : 'bg-yellow-400 text-black'
                    }`}
                  >
                    <option value="pending">In attesa</option>
                    <option value="accepted">Accettata</option>
                    <option value="rejected">Rifiutata</option>
                  </select>
                  <button onClick={() => deleteApp(a.id)} className="rounded-lg border-2 border-black bg-error-container px-3 py-2 text-on-error-container shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t-2 border-black/20 pt-3">
                {(a.answers || []).map((ans, i) => (
                  <div key={i}>
                    <p className="font-label-caps text-[10px] text-on-surface-variant">{ans.label}</p>
                    <p className="font-body-sm text-[14px] text-white">
                      {Array.isArray(ans.value) ? ans.value.join(', ') : ans.value === true ? 'Sì' : ans.value === false ? 'No' : String(ans.value ?? '—')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className={label}>Nota admin</label>
                <input
                  className={input}
                  defaultValue={a.admin_note ?? ''}
                  onBlur={(e) => { if (e.target.value !== (a.admin_note ?? '')) updateApp(a.id, { admin_note: e.target.value }); }}
                  placeholder="Nota interna (salvata all'uscita dal campo)…"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmpAdminSection;
