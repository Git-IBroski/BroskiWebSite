import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { formatVersionsCompact } from '../config/mcVersions';

interface ModData {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  author_id: string;
  author_name: string;
  version: string;
  mc_version: string;
  category: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number;
  images: string[];
  icon_url: string | null;
  downloads: number;
  status: string;
  loaders: string[];
  tags: string[];
  license: string;
  source_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  environments: string[];
  supported_mc_versions: string[];
  created_at: string;
  updated_at: string;
}

interface ModVersion {
  id: string;
  mod_id: string;
  version_number: string;
  title: string;
  changelog: string | null;
  mc_versions: string[];
  loaders: string[];
  release_channel: 'release' | 'beta' | 'alpha';
  file_url: string | null;
  file_name: string | null;
  file_size: number;
  downloads: number;
  published_at: string;
  created_at: string;
}

interface ModMessage {
  id: string;
  mod_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

type TabType = 'description' | 'gallery' | 'changelog' | 'versions' | 'moderation';

const CHANNEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  release: { bg: 'bg-green-600', text: 'text-white', label: 'R' },
  beta: { bg: 'bg-yellow-500', text: 'text-black', label: 'B' },
  alpha: { bg: 'bg-red-500', text: 'text-white', label: 'A' },
};

const LOADER_COLORS: Record<string, { text: string; bg: string }> = {
  'Bukkit': { text: 'text-orange-400', bg: 'bg-orange-400/20' },
  'Folia': { text: 'text-green-400', bg: 'bg-green-400/20' },
  'Paper': { text: 'text-pink-400', bg: 'bg-pink-400/20' },
  'Purpur': { text: 'text-purple-400', bg: 'bg-purple-400/20' },
  'Spigot': { text: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  'Sponge': { text: 'text-yellow-300', bg: 'bg-yellow-300/20' },
  'Fabric': { text: 'text-amber-200', bg: 'bg-amber-200/20' },
  'Forge': { text: 'text-blue-400', bg: 'bg-blue-400/20' },
  'NeoForge': { text: 'text-orange-500', bg: 'bg-orange-500/20' },
  'Quilt': { text: 'text-purple-300', bg: 'bg-purple-300/20' },
  'BungeeCord': { text: 'text-yellow-300', bg: 'bg-yellow-300/20' },
  'Velocity': { text: 'text-cyan-400', bg: 'bg-cyan-400/20' },
  'Waterfall': { text: 'text-blue-400', bg: 'bg-blue-400/20' },
};

const getLoaderClasses = (name: string) => {
  const colors = LOADER_COLORS[name];
  return colors ? `${colors.text} ${colors.bg}` : 'text-on-surface-variant bg-surface-container-highest';
};

const ModDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mod, setMod] = useState<ModData | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [downloading, setDownloading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [dlSelectedVersion, setDlSelectedVersion] = useState<string | null>(null);
  const [dlSelectedLoader, setDlSelectedLoader] = useState<string | null>(null);
  const [dlVersionDropdownOpen, setDlVersionDropdownOpen] = useState(false);
  const [dlLoaderDropdownOpen, setDlLoaderDropdownOpen] = useState(false);
  const [dlVersionSearch, setDlVersionSearch] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryDragOver, setGalleryDragOver] = useState(false);

  const isAuthor = user?.id === mod?.author_id;
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const fetchMod = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('mods')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const modData = data as ModData;
        if (modData.status !== 'approved') {
          const author = user?.id === modData.author_id;
          const admin = profile?.role === 'admin';
          if (!author && !admin) {
            setMod(null);
            setLoading(false);
            return;
          }
        }
        setMod(modData);
      }
      setLoading(false);
    };
    fetchMod();
  }, [id, user, profile]);

  useEffect(() => {
    const fetchVersions = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('mod_versions')
        .select('*')
        .eq('mod_id', id)
        .order('published_at', { ascending: false });
      if (data) setVersions(data as ModVersion[]);
    };
    fetchVersions();
  }, [id]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!id || (!isAuthor && !isAdmin)) return;
      const { data } = await supabase
        .from('mod_messages')
        .select('*')
        .eq('mod_id', id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ModMessage[]);
    };
    if (mod) fetchMessages();
  }, [id, mod, isAuthor, isAdmin]);

  // Check if user follows this creator and has saved this project
  useEffect(() => {
    const checkFollowAndSave = async () => {
      if (!user || !mod) return;
      const { data: followData } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('creator_id', mod.author_id)
        .maybeSingle();
      setIsFollowing(!!followData);

      const { data: saveData } = await supabase
        .from('user_saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('mod_id', mod.id)
        .maybeSingle();
      setIsSaved(!!saveData);
    };
    checkFollowAndSave();
  }, [user, mod]);

  // Fetch creator's minecraft username for avatar
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!mod) return;
      const { data } = await supabase
        .from('profiles')
        .select('minecraft_username')
        .eq('id', mod.author_id)
        .single();
      if (data) setCreatorUsername(data.minecraft_username);
    };
    fetchCreatorProfile();
  }, [mod]);

  const toggleFollow = async () => {
    if (!user || !mod) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('creator_id', mod.author_id);
      setIsFollowing(false);
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, creator_id: mod.author_id });
      setIsFollowing(true);
    }
  };

  const toggleSave = async () => {
    if (!user || !mod) return;
    if (isSaved) {
      await supabase.from('user_saves').delete().eq('user_id', user.id).eq('mod_id', mod.id);
      setIsSaved(false);
    } else {
      await supabase.from('user_saves').insert({ user_id: user.id, mod_id: mod.id });
      setIsSaved(true);
    }
  };

  const handleGalleryUpload = async () => {
    if (!galleryFile || !mod || !user) return;
    setGalleryUploading(true);
    try {
      const imgPath = `${user.id}/${Date.now()}_gallery_${galleryFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('mod-images').upload(imgPath, galleryFile);
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('mod-images').getPublicUrl(imgPath);

      const newImages = [...(mod.images || []), urlData.publicUrl];
      const currentCaptions: string[] = (mod as any).image_captions || [];
      const newCaptions = [...currentCaptions, galleryCaption.trim().slice(0, 30)];

      await supabase.from('mods').update({
        images: newImages,
        image_captions: newCaptions,
      }).eq('id', mod.id);

      setMod({ ...mod, images: newImages });
      setGalleryFile(null);
      setGalleryCaption('');
      setShowGalleryUpload(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeleteImage = async (index: number) => {
    if (!mod) return;
    const newImages = mod.images.filter((_, i) => i !== index);
    const currentCaptions: string[] = (mod as any).image_captions || [];
    const newCaptions = currentCaptions.filter((_, i) => i !== index);
    await supabase.from('mods').update({ images: newImages, image_captions: newCaptions }).eq('id', mod.id);
    setMod({ ...mod, images: newImages });
  };

  const handleDeleteVersion = async (versionId: string) => {
    await supabase.from('mod_versions').delete().eq('id', versionId);
    setVersions(versions.filter(v => v.id !== versionId));
  };

  const handleDownload = async (fileUrl?: string | null, fileName?: string | null) => {
    const url = fileUrl || mod?.file_url;
    const name = fileName || mod?.file_name;
    if (!url) return;
    setDownloading(true);
    if (mod) {
      await supabase
        .from('mods')
        .update({ downloads: mod.downloads + 1 })
        .eq('id', mod.id);
      setMod({ ...mod, downloads: mod.downloads + 1 });
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = name || 'download.jar';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloading(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !mod || !user || !profile) return;
    setSendingMessage(true);
    const { data, error } = await supabase.from('mod_messages').insert({
      mod_id: mod.id,
      author_id: user.id,
      author_name: profile.minecraft_username || profile.email,
      author_role: profile.role,
      content: newMessage.trim(),
      is_system: false,
    }).select().single();
    if (!error && data) {
      setMessages([...messages, data as ModMessage]);
      setNewMessage('');
    }
    setSendingMessage(false);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Adesso';
    if (hours < 24) return `${hours} ore fa`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} giorni fa`;
    if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
    if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
    return `${Math.floor(days / 365)} anni fa`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatDownloads = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const totalDownloads = mod ? mod.downloads + versions.reduce((sum, v) => sum + v.downloads, 0) : 0;

  if (loading) {
    return (
      <PageAnimator className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </PageAnimator>
    );
  }

  if (!mod) {
    return (
      <PageAnimator className="flex min-h-[calc(100vh-76px)] flex-col items-center justify-center gap-4 px-4">
        <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">block</span>
        <p className="font-headline-md text-[20px] text-white">Progetto non trovato</p>
        <Link to="/mods" className="rounded-2xl border-[3px] border-black bg-surface-container-high px-6 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1">
          TORNA AI PROGETTI
        </Link>
      </PageAnimator>
    );
  }

  const tabs: { key: TabType; label: string; icon: string; show: boolean }[] = [
    { key: 'description', label: 'Description', icon: 'description', show: true },
    { key: 'gallery', label: 'Gallery', icon: 'photo_library', show: true },
    { key: 'changelog', label: 'Changelog', icon: 'history', show: true },
    { key: 'versions', label: 'Versions', icon: 'inventory_2', show: true },
    { key: 'moderation', label: 'Moderation', icon: 'shield', show: isAuthor || isAdmin },
  ];

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1280px]">
        {/* Project Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border-[3px] border-black bg-surface-container-high shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {mod.icon_url ? (
                <img src={mod.icon_url} alt={mod.title} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                  {mod.category === 'plugin' ? 'extension' : mod.category === 'mod' ? 'build' : 'inventory_2'}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-md text-[24px] text-white sm:text-[28px]">{mod.title}</h1>
                <span className={`rounded-lg px-2 py-0.5 font-label-caps text-[9px] ${
                  mod.status === 'approved' ? 'bg-green-600 text-white' :
                  mod.status === 'pending' ? 'bg-yellow-600 text-white' :
                  'bg-error text-white'
                }`}>
                  {mod.status === 'approved' ? 'Public' : mod.status === 'pending' ? 'In Review' : mod.status}
                </span>
              </div>
              <p className="font-body-sm text-[13px] text-on-surface-variant">
                {mod.subtitle || `di ${mod.author_name}`}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 font-label-caps text-[10px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {formatDownloads(totalDownloads)}
                </span>
                <span className="flex items-center gap-1 font-label-caps text-[10px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">favorite</span>
                  0
                </span>
                {(mod.tags || []).map((tag) => (
                  <span key={tag} className="rounded-md bg-surface-container-highest px-2 py-0.5 font-label-caps text-[9px] text-on-surface-variant">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isAuthor && (
              <button
                onClick={() => navigate(`/mods/${mod.id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-green-600 px-4 py-2.5 font-label-caps text-[11px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Edit project
              </button>
            )}
            {mod.file_url && (
              <button
                onClick={() => setShowDownloadModal(true)}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-primary-container px-4 py-2.5 font-label-caps text-[11px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                {downloading ? '...' : 'Download'}
              </button>
            )}
            <button onClick={toggleFollow} className={`rounded-xl border-[2px] border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 ${isFollowing ? 'bg-red-500/20' : 'bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{isFollowing ? 'favorite' : 'favorite_border'}</span>
            </button>
            <button onClick={toggleSave} className={`rounded-xl border-[2px] border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 ${isSaved ? 'bg-primary-container/20' : 'bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{isSaved ? 'bookmark' : 'bookmark_border'}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-2xl border-[3px] border-black bg-surface-container p-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-label-caps text-[11px] transition-all ${
                activeTab === tab.key
                  ? tab.key === 'moderation' ? 'bg-red-500/80 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-primary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main content + sidebar */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* DESCRIPTION TAB */}
            {activeTab === 'description' && (
              <div className="rounded-2xl border-[3px] border-black bg-surface-container p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="font-headline-md text-[28px] text-white mt-8 mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="font-headline-md text-[22px] text-white mt-6 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="font-headline-md text-[18px] text-white mt-5 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="font-body-sm text-on-surface-variant leading-relaxed mb-4">{children}</p>,
                      strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-on-surface-variant/40 pl-4 my-4 italic text-on-surface-variant/80">{children}</blockquote>
                      ),
                      ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1 text-on-surface-variant">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1 text-on-surface-variant">{children}</ol>,
                      li: ({ children }) => <li className="font-body-sm text-on-surface-variant">{children}</li>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return <code className="block rounded-xl bg-surface-container-highest p-4 font-mono text-[13px] text-tertiary overflow-x-auto my-4">{children}</code>;
                        }
                        return <code className="rounded bg-surface-container-highest px-1.5 py-0.5 font-mono text-[12px] text-tertiary">{children}</code>;
                      },
                      pre: ({ children }) => <pre className="rounded-xl bg-surface-container-highest p-4 overflow-x-auto my-4">{children}</pre>,
                      hr: () => <hr className="border-on-surface-variant/20 my-6" />,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-tertiary hover:underline">{children}</a>,
                      img: ({ src, alt }) => <img src={src} alt={alt || ''} className="rounded-xl border border-black/20 my-4 max-w-full" />,
                      table: ({ children }) => <table className="w-full border-collapse my-4">{children}</table>,
                      th: ({ children }) => <th className="border border-black/30 bg-surface-container-high px-3 py-2 text-left font-label-caps text-[10px] text-on-surface-variant">{children}</th>,
                      td: ({ children }) => <td className="border border-black/30 px-3 py-2 font-body-sm text-[13px] text-on-surface-variant">{children}</td>,
                    }}
                  >
                    {mod.description}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* GALLERY TAB */}
            {activeTab === 'gallery' && (
              <div className="rounded-2xl border-[3px] border-black bg-surface-container p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                {/* Upload button for owner */}
                {isAuthor && (
                  <div className="mb-5 flex justify-end">
                    <button
                      onClick={() => setShowGalleryUpload(!showGalleryUpload)}
                      className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-tertiary px-4 py-2 font-label-caps text-[11px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                      Add Image
                    </button>
                  </div>
                )}

                {/* Upload form */}
                {showGalleryUpload && isAuthor && (
                  <div className="mb-6 rounded-xl border-[2px] border-black/40 bg-surface-container-high p-5">
                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setGalleryDragOver(true); }}
                      onDragLeave={() => setGalleryDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setGalleryDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) setGalleryFile(file);
                      }}
                      onClick={() => document.getElementById('gallery-file-input')?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-[3px] border-dashed p-8 transition-all ${
                        galleryDragOver ? 'border-tertiary bg-tertiary/10' : galleryFile ? 'border-green-500 bg-green-500/5' : 'border-outline hover:border-primary-container'
                      }`}
                    >
                      <input
                        id="gallery-file-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setGalleryFile(e.target.files?.[0] || null)}
                      />
                      {galleryFile ? (
                        <>
                          <span className="material-symbols-outlined text-[36px] text-green-400">check_circle</span>
                          <p className="font-body-sm text-[14px] text-white font-bold">{galleryFile.name}</p>
                          <p className="font-label-caps text-[10px] text-on-surface-variant">{(galleryFile.size / 1024).toFixed(1)} KB</p>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[36px] text-on-surface-variant/50">cloud_upload</span>
                          <p className="font-body-sm text-[14px] text-on-surface-variant">Drag & drop an image here or click to browse</p>
                          <p className="font-label-caps text-[10px] text-on-surface-variant/60">PNG, JPG, WEBP</p>
                        </>
                      )}
                    </div>

                    {/* Caption field */}
                    <div className="mt-4">
                      <label className="mb-1.5 block font-label-caps text-[10px] text-on-surface-variant">CAPTION (max 30 characters)</label>
                      <input
                        type="text"
                        value={galleryCaption}
                        onChange={(e) => setGalleryCaption(e.target.value.slice(0, 30))}
                        maxLength={30}
                        placeholder="Describe this image..."
                        className="w-full rounded-xl border-[2px] border-black/40 bg-surface-container px-4 py-2.5 font-body-sm text-[14px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary-container"
                      />
                      <p className="mt-1 text-right font-label-caps text-[9px] text-on-surface-variant/50">{galleryCaption.length}/30</p>
                    </div>

                    {/* Upload button */}
                    <button
                      onClick={handleGalleryUpload}
                      disabled={!galleryFile || galleryUploading}
                      className="mt-4 w-full rounded-xl border-[2px] border-black bg-primary-container px-4 py-3 font-headline-md text-[14px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {galleryUploading ? 'Uploading...' : 'Upload Image'}
                    </button>
                  </div>
                )}

                {/* Gallery grid */}
                {mod.images && mod.images.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {mod.images.map((img, i) => (
                      <div key={i} className="relative group/img">
                        <img src={img} alt={`${mod.title} screenshot ${i + 1}`}
                          className="w-full rounded-2xl border-[3px] border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
                        {(mod as any).image_captions?.[i] && (
                          <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/70 px-3 py-1.5 backdrop-blur-sm">
                            <p className="font-label-caps text-[10px] text-white">{(mod as any).image_captions[i]}</p>
                          </div>
                        )}
                        {isAuthor && (
                          <button
                            onClick={() => handleDeleteImage(i)}
                            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg border-[2px] border-black bg-error text-white opacity-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-opacity group-hover/img:opacity-100"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showGalleryUpload && (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">photo_library</span>
                      <p className="font-body-sm text-on-surface-variant">Nessuno screenshot disponibile.</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* CHANGELOG TAB */}
            {activeTab === 'changelog' && (
              <div className="rounded-2xl border-[3px] border-black bg-surface-container p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                {versions.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    {versions.map((v) => (
                      <div key={v.id} className="relative pl-6 border-l-[3px] border-primary-container/40">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-[3px] border-primary-container bg-surface-container" />
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-headline-md text-[16px] text-white">{v.title}</h3>
                          <span className="font-body-sm text-[12px] text-on-surface-variant">
                            by {mod.author_name}
                          </span>
                          <span className="font-body-sm text-[12px] text-on-surface-variant">
                            on {formatDate(v.published_at)}
                          </span>
                          <button
                            onClick={() => handleDownload(v.file_url, v.file_name)}
                            className="ml-auto font-label-caps text-[10px] text-tertiary hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                            Download
                          </button>
                        </div>
                        {v.changelog && (
                          <div className="whitespace-pre-wrap font-body-sm text-[13px] text-on-surface-variant leading-relaxed rounded-xl bg-surface-container-high p-4 border border-black/30">
                            {v.changelog}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {v.loaders.map((l) => (
                            <span key={l} className={`rounded-md px-2 py-0.5 font-label-caps text-[9px] ${getLoaderClasses(l)}`}>{l}</span>
                          ))}
                          {v.mc_versions.map((mc) => (
                            <span key={mc} className="rounded-md bg-surface-container-highest px-2 py-0.5 font-label-caps text-[9px] text-on-surface-variant">{mc}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">history</span>
                    <p className="font-body-sm text-on-surface-variant">Nessun changelog disponibile.</p>
                  </div>
                )}
              </div>
            )}

            {/* VERSIONS TAB */}
            {activeTab === 'versions' && (
              <div className="rounded-2xl border-[3px] border-black bg-surface-container p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                {isAuthor && (
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={() => navigate(`/mods/${mod.id}/version/new`)}
                      className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-tertiary px-4 py-2 font-label-caps text-[11px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Create version
                    </button>
                  </div>
                )}
                {versions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-[2px] border-black/30">
                          <th className="pb-3 font-label-caps text-[10px] text-on-surface-variant">Name</th>
                          <th className="pb-3 font-label-caps text-[10px] text-on-surface-variant">Game version</th>
                          <th className="pb-3 font-label-caps text-[10px] text-on-surface-variant">Platforms</th>
                          <th className="pb-3 font-label-caps text-[10px] text-on-surface-variant">Published</th>
                          <th className="pb-3 font-label-caps text-[10px] text-on-surface-variant">Downloads</th>
                          <th className="pb-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((v) => {
                          const channel = CHANNEL_COLORS[v.release_channel] || CHANNEL_COLORS.release;
                          return (
                            <tr key={v.id} className="border-b border-black/10 hover:bg-surface-container-high/50">
                              <td className="py-3 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-md font-label-caps text-[10px] ${channel.bg} ${channel.text}`}>
                                    {channel.label}
                                  </span>
                                  <div>
                                    <p className="font-headline-md text-[13px] text-white">{v.version_number}</p>
                                    <p className="font-body-sm text-[11px] text-on-surface-variant">{v.title}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-3">
                                <div className="flex flex-wrap gap-1">
                                  {v.mc_versions.slice(0, 3).map((mc) => (
                                    <span key={mc} className="rounded bg-surface-container-highest px-1.5 py-0.5 font-label-caps text-[9px] text-on-surface-variant">{mc}</span>
                                  ))}
                                  {v.mc_versions.length > 3 && (
                                    <span className="font-label-caps text-[9px] text-on-surface-variant">+{v.mc_versions.length - 3}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 pr-3">
                                <div className="flex flex-wrap gap-1">
                                  {v.loaders.map((l) => (
                                    <span key={l} className={`rounded-md px-2 py-0.5 font-label-caps text-[9px] ${getLoaderClasses(l)}`}>{l}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 pr-3 font-body-sm text-[12px] text-on-surface-variant">
                                {formatTimeAgo(v.published_at)}
                              </td>
                              <td className="py-3 pr-3 font-body-sm text-[12px] text-on-surface-variant">
                                {formatDownloads(v.downloads)}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  {v.file_url && (
                                    <button onClick={() => handleDownload(v.file_url, v.file_name)}
                                      className="rounded-lg p-1.5 hover:bg-surface-container-high">
                                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">download</span>
                                    </button>
                                  )}
                                  {isAuthor && (
                                    <button onClick={() => handleDeleteVersion(v.id)}
                                      className="rounded-lg p-1.5 hover:bg-error/20">
                                      <span className="material-symbols-outlined text-[16px] text-error">delete</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">inventory_2</span>
                    <p className="font-body-sm text-on-surface-variant">Nessuna versione disponibile.</p>
                  </div>
                )}
              </div>
            )}

            {/* MODERATION TAB */}
            {activeTab === 'moderation' && (isAuthor || isAdmin) && (
              <div className="flex flex-col gap-4">
                {/* Status banner */}
                <div className={`rounded-2xl border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                  mod.status === 'approved' ? 'bg-green-900/40' :
                  mod.status === 'pending' ? 'bg-yellow-900/40' :
                  mod.status === 'rejected' ? 'bg-red-900/40' : 'bg-surface-container'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px] text-white">
                      {mod.status === 'approved' ? 'check_circle' : mod.status === 'pending' ? 'hourglass_top' : 'cancel'}
                    </span>
                    <h3 className="font-headline-md text-[16px] text-white">
                      {mod.status === 'approved' ? 'Project approved' :
                       mod.status === 'pending' ? 'Project in review' :
                       mod.status === 'rejected' ? 'Project rejected' : 'On hold'}
                    </h3>
                  </div>
                  <p className="font-body-sm text-[13px] text-on-surface-variant">
                    {mod.status === 'approved' ? 'Your project is published and discoverable on Broski.' :
                     mod.status === 'pending' ? 'Your project is being reviewed by our moderators.' :
                     mod.status === 'rejected' ? 'Your project was not approved. Check the messages below for details.' :
                     'Your project is on hold. Please check the messages below.'}
                  </p>
                </div>

                {/* Messages thread */}
                <div className="rounded-2xl border-[3px] border-black bg-surface-container p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="mb-4 font-headline-md text-[16px] text-white">Moderation messages</h3>
                  <p className="mb-4 font-body-sm text-[12px] text-on-surface-variant">
                    This is a private conversation thread with the Broski moderators.
                  </p>

                  {/* Messages list */}
                  <div className="flex flex-col gap-3 mb-4">
                    {messages.length === 0 ? (
                      <p className="py-4 text-center font-body-sm text-[13px] text-on-surface-variant/60">
                        No messages yet.
                      </p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`rounded-xl p-3 ${
                          msg.is_system ? 'bg-surface-container-high border border-black/20' :
                          msg.author_role === 'admin' ? 'bg-red-900/20 border border-red-500/30' :
                          'bg-surface-container-high border border-black/20'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                              msg.author_role === 'admin' ? 'bg-red-500' : 'bg-primary-container'
                            }`}>
                              <span className="material-symbols-outlined text-[12px] text-white">
                                {msg.author_role === 'admin' ? 'shield' : 'person'}
                              </span>
                            </div>
                            <span className="font-headline-md text-[12px] text-white">{msg.author_name}</span>
                            {msg.author_role === 'admin' && (
                              <span className="rounded bg-red-500/80 px-1.5 py-0.5 font-label-caps text-[8px] text-white">Moderator</span>
                            )}
                            <span className="ml-auto font-body-sm text-[10px] text-on-surface-variant">{formatTimeAgo(msg.created_at)}</span>
                          </div>
                          <p className="font-body-sm text-[13px] text-on-surface-variant whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply box */}
                  <div className="border-t border-black/20 pt-4">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Reply to thread..."
                      rows={3}
                      className="w-full rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary-container resize-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-primary-container px-4 py-2 font-label-caps text-[11px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">reply</span>
                        {sendingMessage ? 'Sending...' : 'Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-[280px]">
            <div className="flex flex-col gap-4">
              {/* Compatibility */}
              <SidebarCard title="Compatibility" icon="sports_esports">
                <p className="font-label-caps text-[10px] text-on-surface-variant">Minecraft: Java Edition</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {formatVersionsCompact(mod.supported_mc_versions || [mod.mc_version]).map((v) => (
                    <span key={v} className="rounded-lg border border-black/30 bg-surface-container-high px-2 py-1 font-label-caps text-[10px] text-on-surface-variant">
                      {v}
                    </span>
                  ))}
                </div>
              </SidebarCard>

              {/* Platforms / Loaders */}
              <SidebarCard title="Platforms" icon="devices">
                <div className="flex flex-wrap gap-1.5">
                  {(mod.loaders && mod.loaders.length > 0) ? mod.loaders.map((l) => (
                    <span key={l} className={`rounded-lg px-2 py-1 font-label-caps text-[10px] ${getLoaderClasses(l)}`}>{l}</span>
                  )) : (
                    <span className="rounded-lg bg-surface-container-highest px-2 py-1 font-label-caps text-[10px] text-on-surface-variant">
                      {mod.category === 'plugin' ? 'Paper' : mod.category === 'mod' ? 'Fabric' : 'Data Pack'}
                    </span>
                  )}
                </div>
              </SidebarCard>

              {/* Tags */}
              <SidebarCard title="Tags" icon="label">
                <div className="flex flex-wrap gap-1.5">
                  {(mod.tags && mod.tags.length > 0) ? mod.tags.map((tag) => (
                    <span key={tag} className="rounded-lg bg-surface-container-high px-2 py-1 font-label-caps text-[10px] text-on-surface-variant">{tag}</span>
                  )) : (
                    <span className="rounded-lg bg-surface-container-high px-2 py-1 font-label-caps text-[10px] text-on-surface-variant">
                      {mod.category}
                    </span>
                  )}
                </div>
              </SidebarCard>

              {/* Creators */}
              <SidebarCard title="Creators" icon="group">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://mc-heads.net/avatar/${creatorUsername || mod.author_name}/64`}
                    alt={mod.author_name}
                    className="h-10 w-10 rounded-xl border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <div>
                    <p className="font-headline-md text-[13px] text-white">{mod.author_name}</p>
                    <p className="font-label-caps text-[9px] text-on-surface-variant">Owner</p>
                  </div>
                </div>
              </SidebarCard>

              {/* Details */}
              <SidebarCard title="Details" icon="info">
                <div className="flex flex-col gap-2.5">
                  <DetailRow icon="gavel" label="Licensed" value={mod.license || 'ARR'} isLink />
                  <DetailRow icon="calendar_today" label="Published" value={formatTimeAgo(mod.created_at)} />
                  <DetailRow icon="update" label="Updated" value={formatTimeAgo(mod.updated_at)} />
                  <DetailRow icon="download" label="Downloads" value={formatDownloads(totalDownloads)} />
                  <DetailRow icon="storage" label="Size" value={formatFileSize(mod.file_size)} />
                </div>
              </SidebarCard>

              {/* External links */}
              {(mod.source_url || mod.wiki_url || mod.discord_url) && (
                <SidebarCard title="Links" icon="link">
                  <div className="flex flex-col gap-2">
                    {mod.source_url && (
                      <a href={mod.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body-sm text-[12px] text-tertiary hover:underline">
                        <span className="material-symbols-outlined text-[14px]">code</span>Source
                      </a>
                    )}
                    {mod.wiki_url && (
                      <a href={mod.wiki_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body-sm text-[12px] text-tertiary hover:underline">
                        <span className="material-symbols-outlined text-[14px]">menu_book</span>Wiki
                      </a>
                    )}
                    {mod.discord_url && (
                      <a href={mod.discord_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body-sm text-[12px] text-tertiary hover:underline">
                        <span className="material-symbols-outlined text-[14px]">chat</span>Discord
                      </a>
                    )}
                  </div>
                </SidebarCard>
              )}
            </div>
          </aside>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link to="/mods" className="inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            TORNA AI PROGETTI
          </Link>
        </div>
      </div>

      {/* Download Modal */}
      {showDownloadModal && mod && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDownloadModal(false)}>
          <div className="relative w-full max-w-[480px] mx-4 rounded-2xl border-[3px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {mod.icon_url ? (
                  <img src={mod.icon_url} alt={mod.title} className="h-10 w-10 rounded-lg border border-black/30 object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[24px] text-on-surface-variant">extension</span>
                )}
                <h2 className="font-headline-md text-[18px] text-white">Download {mod.title}</h2>
              </div>
              <button onClick={() => setShowDownloadModal(false)} className="rounded-lg p-1.5 hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
              </button>
            </div>

            {/* Game version selector */}
            <div className="mb-4">
              <button
                onClick={() => { setDlVersionDropdownOpen(!dlVersionDropdownOpen); setDlLoaderDropdownOpen(false); }}
                className="flex w-full items-center justify-between rounded-xl border-[2px] border-black/40 bg-surface-container-high px-4 py-3 transition-all hover:border-black/60"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">sports_esports</span>
                  <span className={`font-body-sm text-[14px] ${dlSelectedVersion ? 'text-white font-bold' : 'text-on-surface-variant'}`}>
                    {dlSelectedVersion || 'Select game version'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {dlVersionDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {dlVersionDropdownOpen && (() => {
                // Compute which versions are available for the selected loader
                const availableVersionsForLoader = dlSelectedLoader
                  ? [...new Set(versions.filter(v => v.loaders.includes(dlSelectedLoader!)).flatMap(v => v.mc_versions))]
                  : null;

                return (
                  <div className="mt-2 rounded-xl border-[2px] border-black/40 bg-surface-container-high overflow-hidden">
                    <div className="p-2 border-b border-black/20">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">search</span>
                        <input
                          type="text"
                          value={dlVersionSearch}
                          onChange={(e) => setDlVersionSearch(e.target.value)}
                          placeholder="Search game versions..."
                          className="w-full rounded-lg bg-surface-container pl-8 pr-3 py-2 font-body-sm text-[13px] text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                        />
                      </div>
                    </div>
                    <div
                      className="overflow-y-auto overscroll-contain p-1.5"
                      style={{ maxHeight: '180px' }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {(mod.supported_mc_versions || [mod.mc_version])
                        .filter(v => !dlVersionSearch || v.includes(dlVersionSearch))
                        .map((v) => {
                          const isAvailable = !availableVersionsForLoader || availableVersionsForLoader.includes(v);
                          return (
                            <button
                              key={v}
                              onClick={() => { if (isAvailable) { setDlSelectedVersion(v); setDlVersionDropdownOpen(false); } }}
                              disabled={!isAvailable}
                              className={`w-full rounded-lg px-3 py-2.5 text-center font-body-sm text-[14px] transition-all ${
                                !isAvailable
                                  ? 'text-on-surface-variant/30 cursor-not-allowed line-through'
                                  : dlSelectedVersion === v
                                    ? 'bg-primary-container/20 text-primary-container font-bold'
                                    : 'text-on-surface-variant hover:bg-surface-container'
                              }`}
                            >
                              {v}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Platform selector — custom dropdown */}
            <div className="mb-6">
              <button
                onClick={() => { setDlLoaderDropdownOpen(!dlLoaderDropdownOpen); setDlVersionDropdownOpen(false); }}
                className="flex w-full items-center justify-between rounded-xl border-[2px] border-black/40 bg-surface-container-high px-4 py-3 transition-all hover:border-black/60"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">build</span>
                  <span className="font-body-sm text-[14px] text-on-surface-variant">Platform:</span>
                  <span className="font-body-sm text-[14px] text-white font-bold">
                    {dlSelectedLoader || (mod.loaders && mod.loaders[0]) || 'Default'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {dlLoaderDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {dlLoaderDropdownOpen && (() => {
                // Compute which loaders are available for the selected version
                const availableLoadersForVersion = dlSelectedVersion
                  ? [...new Set(versions.filter(v => v.mc_versions.includes(dlSelectedVersion!)).flatMap(v => v.loaders))]
                  : null;

                return (
                  <div
                    className="mt-2 rounded-xl border-[2px] border-black/40 bg-surface-container-high overflow-y-auto overscroll-contain p-1.5"
                    style={{ maxHeight: '180px' }}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {(mod.loaders && mod.loaders.length > 0 ? mod.loaders : ['Default']).map((l) => {
                      const isAvailable = !availableLoadersForVersion || availableLoadersForVersion.includes(l);
                      return (
                        <button
                          key={l}
                          onClick={() => { if (isAvailable) { setDlSelectedLoader(l); setDlLoaderDropdownOpen(false); } }}
                          disabled={!isAvailable}
                          className={`w-full rounded-lg px-3 py-2.5 text-center font-body-sm text-[14px] transition-all ${
                            !isAvailable
                              ? 'text-on-surface-variant/30 cursor-not-allowed line-through'
                              : (dlSelectedLoader || (mod.loaders && mod.loaders[0]) || '') === l
                                ? 'bg-primary-container/20 text-primary-container font-bold'
                                : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Download button */}
            <button
              onClick={() => {
                const matchingVersion = versions.find(v =>
                  (!dlSelectedVersion || v.mc_versions.includes(dlSelectedVersion)) &&
                  (!dlSelectedLoader || v.loaders.includes(dlSelectedLoader))
                );
                if (matchingVersion?.file_url) {
                  handleDownload(matchingVersion.file_url, matchingVersion.file_name);
                } else {
                  handleDownload();
                }
                setShowDownloadModal(false);
              }}
              className="w-full rounded-xl border-[2px] border-black bg-primary-container px-4 py-3.5 font-headline-md text-[15px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Download
            </button>
          </div>
        </div>
      )}
    </PageAnimator>
  );
};

// Sidebar components

const SidebarCard: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-2xl border-[3px] border-black bg-surface-container p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
    <h3 className="mb-2.5 flex items-center gap-1.5 font-headline-md text-[13px] text-white">
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {title}
    </h3>
    {children}
  </div>
);

const DetailRow: React.FC<{ icon: string; label: string; value: string; isLink?: boolean }> = ({ icon, label, value, isLink }) => (
  <div className="flex items-center gap-2">
    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{icon}</span>
    <span className="flex-1 font-body-sm text-[12px] text-on-surface-variant">{label}</span>
    <span className={`font-body-sm text-[12px] font-bold ${isLink ? 'text-tertiary' : 'text-white'}`}>{value}</span>
  </div>
);

export default ModDetail;
