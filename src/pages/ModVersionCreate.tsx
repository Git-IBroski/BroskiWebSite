import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import McVersionDropdown from '../components/McVersionDropdown';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const LOADERS = [
  'Bukkit','Folia','Paper','Purpur','Spigot','Sponge',
  'Fabric','Forge','NeoForge','Quilt',
];

const ModVersionCreate: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [versionNumber, setVersionNumber] = useState('');
  const [title, setTitle] = useState('');
  const [changelog, setChangelog] = useState('');
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [releaseChannel, setReleaseChannel] = useState<'release'|'beta'|'alpha'>('release');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user || !id) return;
    if (!versionNumber.trim() || !title.trim()) {
      setError('Version number and title are required.'); return;
    }
    if (!file) { setError('A file is required.'); return; }

    setLoading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('mod-files').upload(filePath, file);
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('mod-files').getPublicUrl(filePath);

      const { error: insertErr } = await supabase.from('mod_versions').insert({
        mod_id: id,
        version_number: versionNumber.trim(),
        title: title.trim(),
        changelog: changelog.trim() || null,
        mc_versions: mcVersions,
        loaders,
        release_channel: releaseChannel,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });
      if (insertErr) throw new Error(insertErr.message);

      // Update main mod version and supported_mc_versions
      const { data: currentMod } = await supabase.from('mods').select('supported_mc_versions').eq('id', id).single();
      const existingVersions: string[] = currentMod?.supported_mc_versions || [];
      const mergedVersions = [...new Set([...existingVersions, ...mcVersions])];

      await supabase.from('mods').update({
        version: versionNumber.trim(),
        mc_version: mcVersions[0] || '1.21',
        supported_mc_versions: mergedVersions,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      navigate(`/mods/${id}`);
    } catch (err: any) {
      setError(err.message || 'Error creating version.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-tertiary/10 blur-3xl" />
      <div className="relative z-10 mx-auto w-full max-w-[800px]">
        <Link to={`/mods/${id}`}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          BACK TO PROJECT
        </Link>

        <div className="mb-8">
          <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[48px]">
            CREATE VERSION
          </h1>
          <p className="mt-2 font-body-sm text-on-surface-variant">
            Add a new version to your project with changelog and files.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="mb-4 font-headline-md text-[20px] text-white">Version Info</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">VERSION NUMBER *</label>
                  <input type="text" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} required placeholder="1.1.0"
                    className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
                </div>
                <div>
                  <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">TITLE *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Bug fixes & improvements"
                    className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container" />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">RELEASE CHANNEL</label>
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
              </div>

              <div>
                <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">CHANGELOG</label>
                <textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={5} placeholder="What's new in this version..."
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container resize-y" />
              </div>

              <div>
                <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">GAME VERSIONS</label>
                <McVersionDropdown selected={mcVersions} onChange={setMcVersions} />
              </div>

              <div>
                <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">LOADERS</label>
                <div className="flex flex-wrap gap-2">
                  {LOADERS.map((l) => (
                    <button key={l} type="button" onClick={() => toggle(loaders, setLoaders, l)}
                      className={`rounded-xl border-[2px] border-black px-3 py-1.5 font-label-caps text-[10px] transition-all ${
                        loaders.includes(l) ? 'bg-primary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface-container-high text-on-surface-variant'
                      }`}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">FILE *</label>
                <input type="file" accept=".jar,.zip,.mrpack" onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="font-body-sm text-[13px] text-on-surface-variant file:mr-3 file:rounded-xl file:border-[2px] file:border-black file:bg-primary-container file:px-4 file:py-2 file:font-label-caps file:text-[10px] file:text-white" />
                {file && <p className="mt-1 font-label-caps text-[10px] text-on-surface-variant">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[4px] border-black bg-tertiary px-6 py-4 font-headline-md text-[18px] text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60">
            <span className="material-symbols-outlined text-[24px]">publish</span>
            {loading ? 'UPLOADING...' : 'PUBLISH VERSION'}
          </button>
        </form>
      </div>
    </PageAnimator>
  );
};

export default ModVersionCreate;
