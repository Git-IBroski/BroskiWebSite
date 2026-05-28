import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import McVersionDropdown from '../components/McVersionDropdown';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'plugin', label: 'Plugin' },
  { value: 'mod', label: 'Mod' },
  { value: 'datapack', label: 'Datapack' },
  { value: 'resourcepack', label: 'Resource Pack' },
  { value: 'shader', label: 'Shader' },
  { value: 'modpack', label: 'Modpack' },
];

const LOADERS = [
  'Bukkit', 'Folia', 'Paper', 'Purpur', 'Spigot', 'Sponge',
  'Fabric', 'Forge', 'NeoForge', 'Quilt',
];

const TAGS = [
  'Adventure', 'Cursed', 'Decoration', 'Economy', 'Equipment',
  'Food', 'Game Mechanics', 'Library', 'Magic', 'Management',
  'Minigame', 'Mobs', 'Optimization', 'Social', 'Storage',
  'Technology', 'Transportation', 'Utility', 'World Generation',
];

const ENVIRONMENTS = ['Client-side', 'Server-side', 'Singleplayer'];
const LICENSES = ['ARR', 'MIT', 'GPL-3.0', 'Apache-2.0', 'BSD-3', 'CC-BY-4.0', 'Unlicense'];

const ModEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('plugin');
  const [version, setVersion] = useState('');
  const [mcVersion, setMcVersion] = useState('');
  const [supportedMcVersions, setSupportedMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [license, setLicense] = useState('ARR');
  const [environments, setEnvironments] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [wikiUrl, setWikiUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingIcon, setExistingIcon] = useState<string | null>(null);

  useEffect(() => {
    const fetchMod = async () => {
      if (!id || !user) return;
      const { data, error: fetchError } = await supabase
        .from('mods').select('*').eq('id', id).single();
      if (fetchError || !data) { navigate('/mods/my'); return; }
      if (data.author_id !== user.id && profile?.role !== 'admin') {
        navigate('/mods/my'); return;
      }
      setTitle(data.title);
      setSubtitle(data.subtitle || '');
      setDescription(data.description);
      setCategory(data.category);
      setVersion(data.version);
      setMcVersion(data.mc_version);
      setSupportedMcVersions(data.supported_mc_versions || []);
      setLoaders(data.loaders || []);
      setTags(data.tags || []);
      setLicense(data.license || 'ARR');
      setEnvironments(data.environments || []);
      setSourceUrl(data.source_url || '');
      setWikiUrl(data.wiki_url || '');
      setDiscordUrl(data.discord_url || '');
      setExistingImages(data.images || []);
      setExistingIcon(data.icon_url);
      setLoading(false);
    };
    fetchMod();
  }, [id, user, profile, navigate]);

  const toggleArray = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!user || !id) return;
    if (!title.trim() || !description.trim()) {
      setError('Titolo e descrizione sono obbligatori.'); return;
    }
    setSaving(true);
    try {
      let iconUrl = existingIcon;
      if (iconFile) {
        const iconPath = `${user.id}/${Date.now()}_icon_${iconFile.name}`;
        const { error: iconErr } = await supabase.storage.from('mod-images').upload(iconPath, iconFile);
        if (!iconErr) {
          const { data: iconUrlData } = supabase.storage.from('mod-images').getPublicUrl(iconPath);
          iconUrl = iconUrlData.publicUrl;
        }
      }

      let allImages = [...existingImages];
      if (imageFiles.length > 0) {
        for (const img of imageFiles) {
          const imgPath = `${user.id}/${Date.now()}_${img.name}`;
          const { error: imgErr } = await supabase.storage.from('mod-images').upload(imgPath, img);
          if (!imgErr) {
            const { data: imgUrlData } = supabase.storage.from('mod-images').getPublicUrl(imgPath);
            allImages.push(imgUrlData.publicUrl);
          }
        }
      }

      const { error: updateError } = await supabase.from('mods').update({
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
        category,
        version,
        mc_version: supportedMcVersions[0] || mcVersion,
        supported_mc_versions: supportedMcVersions,
        loaders,
        tags,
        license,
        environments,
        source_url: sourceUrl || null,
        wiki_url: wikiUrl || null,
        discord_url: discordUrl || null,
        icon_url: iconUrl,
        images: allImages,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (updateError) throw new Error(updateError.message);

      // Add system message about re-submission
      await supabase.from('mod_messages').insert({
        mod_id: id,
        author_id: user.id,
        author_name: profile?.minecraft_username || profile?.email || 'User',
        author_role: profile?.role || 'user',
        content: 'Project updated and re-submitted for review.',
        is_system: true,
      });

      setSuccess('Progetto aggiornato e rimandato in revisione!');
      setTimeout(() => navigate(`/mods/${id}`), 1500);
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageAnimator className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </PageAnimator>
    );
  }

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-green-500/10 blur-3xl" />
      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link to={`/mods/${id}`}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          BACK TO PROJECT
        </Link>

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-green-600 px-4 py-2 font-label-caps text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            EDIT PROJECT
          </div>
          <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[48px]">
            {title || 'Edit Project'}
          </h1>
          <p className="mt-2 font-body-sm text-on-surface-variant">
            Modifica il tuo progetto. Dopo il salvataggio verrà rimandato in revisione.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Basic info */}
          <FormSection title="Informazioni Base">
            <div className="flex flex-col gap-4">
              <FormField label="TITOLO *">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
              <FormField label="SOTTOTITOLO">
                <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
              <FormField label="DESCRIZIONE * (supporta Markdown)">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={10}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container resize-y" />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="TIPO *">
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </FormField>
                <FormField label="VERSIONE PROGETTO">
                  <input type="text" value={version} onChange={(e) => setVersion(e.target.value)}
                    className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
                </FormField>
              </div>
              <FormField label="VERSIONI MC SUPPORTATE">
                <p className="mb-2 font-body-sm text-[11px] text-on-surface-variant/70">Seleziona tutte le versioni di Minecraft con cui il tuo progetto è compatibile.</p>
                <McVersionDropdown selected={supportedMcVersions} onChange={setSupportedMcVersions} />
              </FormField>
            </div>
          </FormSection>

          {/* Loaders & Tags */}
          <FormSection title="Loaders & Tags">
            <FormField label="LOADERS / PLATFORMS">
              <div className="flex flex-wrap gap-2">
                {LOADERS.map((l) => (
                  <button key={l} type="button" onClick={() => toggleArray(loaders, setLoaders, l)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      loaders.includes(l) ? 'bg-primary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{l}</button>
                ))}
              </div>
            </FormField>
            <FormField label="TAGS / CATEGORIES">
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => toggleArray(tags, setTags, t)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      tags.includes(t) ? 'bg-secondary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{t}</button>
                ))}
              </div>
            </FormField>
            <FormField label="ENVIRONMENTS">
              <div className="flex flex-wrap gap-2">
                {ENVIRONMENTS.map((env) => (
                  <button key={env} type="button" onClick={() => toggleArray(environments, setEnvironments, env)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      environments.includes(env) ? 'bg-tertiary text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{env}</button>
                ))}
              </div>
            </FormField>
          </FormSection>

          {/* License & Links */}
          <FormSection title="License & Links">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="LICENSE">
                <select value={license} onChange={(e) => setLicense(e.target.value)}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none">
                  {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="SOURCE URL">
                <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/..."
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
              <FormField label="WIKI URL">
                <input type="url" value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)} placeholder="https://..."
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
              <FormField label="DISCORD URL">
                <input type="url" value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.gg/..."
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
            </div>
          </FormSection>

          {/* Media */}
          <FormSection title="Media">
            <FormField label="ICONA">
              <div className="flex items-center gap-4">
                {existingIcon && !iconFile && (
                  <img src={existingIcon} alt="Current icon" className="h-16 w-16 rounded-xl border-[2px] border-black object-cover" />
                )}
                <input type="file" accept="image/*" onChange={(e) => setIconFile(e.target.files?.[0] || null)}
                  className="font-body-sm text-[13px] text-on-surface-variant file:mr-3 file:rounded-xl file:border-[2px] file:border-black file:bg-surface-container-high file:px-3 file:py-1.5 file:font-label-caps file:text-[10px] file:text-on-surface-variant" />
              </div>
            </FormField>
            <FormField label="SCREENSHOT (aggiungi nuovi)">
              {existingImages.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {existingImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt={`Screenshot ${i+1}`} className="h-20 w-32 rounded-lg border border-black/30 object-cover" />
                      <button type="button" onClick={() => setExistingImages(existingImages.filter((_, idx) => idx !== i))}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[10px] text-white">×</button>
                    </div>
                  ))}
                </div>
              )}
              <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                className="font-body-sm text-[13px] text-on-surface-variant file:mr-3 file:rounded-xl file:border-[2px] file:border-black file:bg-surface-container-high file:px-3 file:py-1.5 file:font-label-caps file:text-[10px] file:text-on-surface-variant" />
            </FormField>
          </FormSection>

          {/* Messages */}
          {error && (
            <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border-[3px] border-black bg-green-900/50 px-4 py-3 font-body-sm font-bold text-green-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {success}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[4px] border-black bg-green-600 px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60">
            <span className="material-symbols-outlined text-[24px]">save</span>
            {saving ? 'SAVING...' : 'SAVE & RE-SUBMIT FOR REVIEW'}
          </button>
          <p className="text-center font-body-sm text-[12px] text-on-surface-variant">
            Il progetto verrà rimandato in revisione. La versione attuale rimarrà pubblica fino all'approvazione.
          </p>
        </form>
      </div>
    </PageAnimator>
  );
};

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
    <h2 className="mb-4 font-headline-md text-[20px] text-white">{title}</h2>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">{label}</label>
    {children}
  </div>
);

export default ModEdit;
