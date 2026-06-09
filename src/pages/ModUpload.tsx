import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

const ModUpload: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Blocca upload mod se IGN non verificato
  if (profile && !profile.ign_verified) {
    return (
      <PageAnimator className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-yellow-500/20 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <span className="material-symbols-outlined text-3xl text-yellow-400">verified_user</span>
            </div>
            <h1 className="font-headline-lg text-[28px] uppercase leading-none text-yellow-400">
              IGN NON VERIFICATO
            </h1>
            <p className="font-body-sm text-on-surface-variant">
              Il tuo Minecraft username deve essere verificato da un Owner prima di poter pubblicare mod.
            </p>
            <Link
              to="/mods"
              className="w-full rounded-2xl border-[3px] border-black bg-surface-bright px-6 py-3 text-center font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1"
            >
              TORNA ALLE MOD
            </Link>
          </div>
        </div>
      </PageAnimator>
    );
  }

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [category, setCategory] = useState('plugin');
  const [loaders, setLoaders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [license, setLicense] = useState('ARR');
  const [environments, setEnvironments] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [wikiUrl, setWikiUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [releaseChannel, setReleaseChannel] = useState<'release'|'beta'|'alpha'>('release');
  const [mcVersions, setMcVersions] = useState<string[]>(['1.21']);
  const [jarFile, setJarFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user || !profile) { setError('Devi essere loggato.'); return; }
    if (!jarFile) { setError('Devi caricare un file.'); return; }
    if (!title.trim() || !description.trim()) { setError('Titolo e descrizione sono obbligatori.'); return; }

    setLoading(true);
    try {
      // Upload file
      const jarPath = `${user.id}/${Date.now()}_${jarFile.name}`;
      const { error: jarError } = await supabase.storage.from('mod-files').upload(jarPath, jarFile);
      if (jarError) throw new Error(`Errore upload: ${jarError.message}`);
      const { data: jarUrlData } = supabase.storage.from('mod-files').getPublicUrl(jarPath);

      // Upload icon
      let iconUrl: string | null = null;
      if (iconFile) {
        const iconPath = `${user.id}/${Date.now()}_icon_${iconFile.name}`;
        const { error: iconErr } = await supabase.storage.from('mod-images').upload(iconPath, iconFile);
        if (!iconErr) {
          const { data: iconUrlData } = supabase.storage.from('mod-images').getPublicUrl(iconPath);
          iconUrl = iconUrlData.publicUrl;
        }
      }

      // Upload images
      const imageUrls: string[] = [];
      for (const img of imageFiles) {
        const imgPath = `${user.id}/${Date.now()}_${img.name}`;
        const { error: imgErr } = await supabase.storage.from('mod-images').upload(imgPath, img);
        if (!imgErr) {
          const { data: imgUrlData } = supabase.storage.from('mod-images').getPublicUrl(imgPath);
          imageUrls.push(imgUrlData.publicUrl);
        }
      }

      // Insert mod
      const { data: modData, error: insertError } = await supabase.from('mods').insert({
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
        author_id: user.id,
        author_name: profile.minecraft_username || profile.email,
        version,
        mc_version: mcVersions[0] || '1.21',
        category,
        loaders,
        tags,
        license,
        environments,
        source_url: sourceUrl || null,
        wiki_url: wikiUrl || null,
        discord_url: discordUrl || null,
        file_url: jarUrlData.publicUrl,
        file_name: jarFile.name,
        file_size: jarFile.size,
        icon_url: iconUrl,
        images: imageUrls,
        status: 'pending',
        supported_mc_versions: mcVersions,
      }).select().single();
      if (insertError) throw new Error(insertError.message);

      // Create initial version entry
      if (modData) {
        await supabase.from('mod_versions').insert({
          mod_id: modData.id,
          version_number: version,
          title: `${title.trim()} V${version}`,
          changelog: `Initial release of ${title.trim()}.`,
          mc_versions: mcVersions,
          loaders,
          release_channel: releaseChannel,
          file_url: jarUrlData.publicUrl,
          file_name: jarFile.name,
          file_size: jarFile.size,
        });

        // System message
        await supabase.from('mod_messages').insert({
          mod_id: modData.id,
          author_id: user.id,
          author_name: profile.minecraft_username || profile.email,
          author_role: 'user',
          content: 'submitted the project for review.',
          is_system: true,
        });
      }

      navigate('/mods/my');
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-tertiary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-40 h-80 w-80 rounded-full bg-primary-container/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        <Link to="/mods"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          TORNA AI PROGETTI
        </Link>

        <div className="mb-8">
          <div className="mb-3 inline-flex -rotate-2 items-center gap-2 rounded-2xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            PUBLISH
          </div>
          <h1 className="font-headline-lg text-[36px] uppercase leading-none tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[52px]">
            NEW PROJECT
          </h1>
          <p className="mt-2 font-body-sm text-on-surface-variant">
            Compila tutti i campi e invia in revisione. Un admin approverà il tuo progetto.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Basic info */}
          <FormSection title="Informazioni Base">
            <FormField label="TITOLO *">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="es. FarLands Corrupted"
                className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
            </FormField>
            <FormField label="SOTTOTITOLO">
              <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Breve descrizione in una riga"
                className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
            </FormField>
            <FormField label="DESCRIZIONE * (supporta Markdown: # ## ### ** * - ` )">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={8}
                placeholder="Descrivi il tuo progetto in dettaglio con formattazione Markdown..."
                className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container resize-y" />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="TIPO *">
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </FormField>
              <FormField label="VERSIONE PROGETTO">
                <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0"
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
              </FormField>
            </div>
          </FormSection>

          {/* Loaders & Tags */}
          <FormSection title="Loaders, Tags & Metadata">
            <FormField label="LOADERS / PLATFORMS">
              <div className="flex flex-wrap gap-2">
                {LOADERS.map((l) => (
                  <button key={l} type="button" onClick={() => toggle(loaders, setLoaders, l)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      loaders.includes(l) ? 'bg-primary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{l}</button>
                ))}
              </div>
            </FormField>
            <FormField label="TAGS / CATEGORIES">
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => toggle(tags, setTags, t)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      tags.includes(t) ? 'bg-secondary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{t}</button>
                ))}
              </div>
            </FormField>
            <FormField label="ENVIRONMENTS">
              <div className="flex flex-wrap gap-2">
                {ENVIRONMENTS.map((env) => (
                  <button key={env} type="button" onClick={() => toggle(environments, setEnvironments, env)}
                    className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                      environments.includes(env) ? 'bg-tertiary text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>{env}</button>
                ))}
              </div>
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="LICENSE">
                <select value={license} onChange={(e) => setLicense(e.target.value)}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none">
                  {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="RELEASE CHANNEL">
                <div className="flex gap-2">
                  {(['release', 'beta', 'alpha'] as const).map((ch) => (
                    <button key={ch} type="button" onClick={() => setReleaseChannel(ch)}
                      className={`rounded-xl border-[2px] border-black px-4 py-2 font-label-caps text-[11px] transition-all ${
                        releaseChannel === ch
                          ? ch === 'release' ? 'bg-green-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : ch === 'beta' ? 'bg-yellow-500 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-red-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</button>
                  ))}
                </div>
              </FormField>
            </div>
          </FormSection>

          {/* Game versions for initial release */}
          <FormSection title="Game Versions">
            <FormField label="VERSIONI MC SUPPORTATE">
              <p className="mb-2 font-body-sm text-[11px] text-on-surface-variant/70">Seleziona tutte le versioni di Minecraft compatibili. Puoi selezionare un intero gruppo (es. tutte le 1.21.x).</p>
              <McVersionDropdown selected={mcVersions} onChange={setMcVersions} />
            </FormField>
          </FormSection>

          {/* Links */}
          <FormSection title="Links (opzionali)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          {/* Files */}
          <FormSection title="Files">
            <FormField label="FILE (.jar, .zip, .mrpack) *">
              <div className="relative">
                <input type="file" accept=".jar,.zip,.mrpack" onChange={(e) => setJarFile(e.target.files?.[0] || null)} className="hidden" id="jar-upload" />
                <label htmlFor="jar-upload"
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border-[3px] border-dashed border-outline bg-surface-container-high p-4 transition-colors hover:border-primary-container">
                  <span className="material-symbols-outlined rounded-xl border-2 border-black bg-primary-container p-2 text-[24px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">upload_file</span>
                  <div>
                    <p className="font-body-sm font-bold text-white">{jarFile ? jarFile.name : 'Clicca per caricare il file'}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant">{jarFile ? `${(jarFile.size / 1024).toFixed(1)} KB` : '.jar, .zip, .mrpack'}</p>
                  </div>
                </label>
              </div>
            </FormField>
            <FormField label="ICONA (opzionale)">
              <div className="relative">
                <input type="file" accept="image/*" onChange={(e) => setIconFile(e.target.files?.[0] || null)} className="hidden" id="icon-upload" />
                <label htmlFor="icon-upload"
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border-[3px] border-dashed border-outline bg-surface-container-high p-4 transition-colors hover:border-primary-container">
                  <span className="material-symbols-outlined rounded-xl border-2 border-black bg-secondary-container p-2 text-[24px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">image</span>
                  <div>
                    <p className="font-body-sm font-bold text-white">{iconFile ? iconFile.name : 'Clicca per caricare un\'icona'}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant">PNG, JPG — 256x256 consigliato</p>
                  </div>
                </label>
              </div>
            </FormField>
            <FormField label="SCREENSHOT (opzionale)">
              <div className="relative">
                <input type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} className="hidden" id="images-upload" />
                <label htmlFor="images-upload"
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border-[3px] border-dashed border-outline bg-surface-container-high p-4 transition-colors hover:border-primary-container">
                  <span className="material-symbols-outlined rounded-xl border-2 border-black bg-tertiary p-2 text-[24px] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">photo_library</span>
                  <div>
                    <p className="font-body-sm font-bold text-white">{imageFiles.length > 0 ? `${imageFiles.length} immagini selezionate` : 'Clicca per caricare screenshot'}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant">Puoi selezionare più immagini</p>
                  </div>
                </label>
              </div>
            </FormField>
          </FormSection>

          {error && (
            <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[4px] border-black bg-primary-container px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined text-[24px]">send</span>
            {loading ? 'CARICAMENTO...' : 'MANDA IN REVISIONE'}
          </button>
          <p className="text-center font-body-sm text-[12px] text-on-surface-variant">
            Il tuo progetto sarà visibile solo a te e agli admin fino all'approvazione.
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

export default ModUpload;
