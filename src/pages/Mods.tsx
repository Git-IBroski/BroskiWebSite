import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatVersionsCompact } from '../config/mcVersions';

interface Mod {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  author_name: string;
  version: string;
  mc_version: string;
  category: string;
  icon_url: string | null;
  downloads: number;
  status: string;
  tags: string[];
  loaders: string[];
  supported_mc_versions: string[];
  created_at: string;
  updated_at: string;
}

type SortBy = 'downloads' | 'newest' | 'updated' | 'title';
type ContentType = 'plugins' | 'mods' | 'datapacks' | 'resourcepacks' | 'shaders' | 'modpacks';

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'mods', label: 'Mods' },
  { value: 'plugins', label: 'Plugins' },
  { value: 'datapacks', label: 'Data Packs' },
  { value: 'resourcepacks', label: 'Resource Packs' },
  { value: 'shaders', label: 'Shaders' },
  { value: 'modpacks', label: 'Modpacks' },
];

const CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: 'adventure', label: 'Adventure', icon: 'explore' },
  { value: 'cursed', label: 'Cursed', icon: 'skull' },
  { value: 'decoration', label: 'Decoration', icon: 'palette' },
  { value: 'economy', label: 'Economy', icon: 'payments' },
  { value: 'equipment', label: 'Equipment', icon: 'shield' },
  { value: 'food', label: 'Food', icon: 'restaurant' },
  { value: 'game-mechanics', label: 'Game Mechanics', icon: 'settings' },
  { value: 'library', label: 'Library', icon: 'menu_book' },
  { value: 'magic', label: 'Magic', icon: 'auto_fix_high' },
  { value: 'management', label: 'Management', icon: 'admin_panel_settings' },
  { value: 'minigame', label: 'Minigame', icon: 'sports_esports' },
  { value: 'mobs', label: 'Mobs', icon: 'pets' },
  { value: 'optimization', label: 'Optimization', icon: 'speed' },
  { value: 'social', label: 'Social', icon: 'group' },
  { value: 'storage', label: 'Storage', icon: 'inventory_2' },
  { value: 'technology', label: 'Technology', icon: 'memory' },
  { value: 'transportation', label: 'Transportation', icon: 'directions_boat' },
  { value: 'utility', label: 'Utility', icon: 'build' },
  { value: 'world-generation', label: 'World Generation', icon: 'terrain' },
];

const MC_VERSIONS = [
  '26.1.2','26.1.1','26.1',
  '1.21.11','1.21.10','1.21.9','1.21.8','1.21.7','1.21.6','1.21.5','1.21.4','1.21.3','1.21.2','1.21.1','1.21',
  '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
  '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
  '1.18.2','1.18.1','1.18',
  '1.17.1','1.17',
  '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
  '1.15.2','1.15.1','1.15',
  '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
  '1.13.2','1.13.1','1.13',
  '1.12.2','1.12.1','1.12',
  '1.11.2','1.11.1','1.11',
  '1.10.2','1.10.1','1.10',
  '1.9.4','1.9.3','1.9.2','1.9.1','1.9',
  '1.8.9','1.8.8','1.8.7','1.8.6','1.8.5','1.8.4','1.8.3','1.8.2','1.8.1','1.8',
  '1.7.10','1.7.9','1.7.8','1.7.7','1.7.6','1.7.5','1.7.4','1.7.3','1.7.2',
  '1.6.4','1.6.2','1.6.1',
  '1.5.2','1.5.1',
  '1.4.7','1.4.6','1.4.5','1.4.4','1.4.2',
  '1.3.2','1.3.1',
  '1.2.5','1.2.4','1.2.3','1.2.2','1.2.1',
  '1.1','1.0',
];

const PLUGIN_LOADERS: { name: string; icon: string; color: string }[] = [
  { name: 'Bukkit', icon: '🧱', color: 'text-orange-400' },
  { name: 'Folia', icon: '🌿', color: 'text-green-400' },
  { name: 'Paper', icon: '✈️', color: 'text-pink-400' },
  { name: 'Purpur', icon: '🟪', color: 'text-purple-400' },
  { name: 'Spigot', icon: '🚰', color: 'text-yellow-400' },
  { name: 'Sponge', icon: '🧽', color: 'text-yellow-300' },
];
const MOD_LOADERS: { name: string; icon: string; color: string }[] = [
  { name: 'Fabric', icon: '🧵', color: 'text-amber-200' },
  { name: 'Forge', icon: '🔨', color: 'text-blue-400' },
  { name: 'NeoForge', icon: '⚡', color: 'text-orange-500' },
  { name: 'Quilt', icon: '🧩', color: 'text-purple-300' },
];

const PLATFORMS: { name: string; icon: string; color: string }[] = [
  { name: 'BungeeCord', icon: '🪢', color: 'text-yellow-300' },
  { name: 'Geyser Extension', icon: '🌊', color: 'text-slate-400' },
  { name: 'Velocity', icon: '🚀', color: 'text-cyan-400' },
  { name: 'Waterfall', icon: '💧', color: 'text-blue-400' },
];

const VIEW_OPTIONS = [10, 20, 50, 100];

// Map loader name to its color class for badges
const ALL_LOADERS = [...PLUGIN_LOADERS, ...MOD_LOADERS, ...PLATFORMS];
const getLoaderColor = (name: string): string => {
  const loader = ALL_LOADERS.find(l => l.name.toLowerCase() === name.toLowerCase());
  return loader?.color || 'text-on-surface-variant';
};
const getLoaderBgColor = (name: string): string => {
  const colorMap: Record<string, string> = {
    'text-orange-400': 'bg-orange-400/20',
    'text-green-400': 'bg-green-400/20',
    'text-pink-400': 'bg-pink-400/20',
    'text-purple-400': 'bg-purple-400/20',
    'text-yellow-400': 'bg-yellow-400/20',
    'text-yellow-300': 'bg-yellow-300/20',
    'text-amber-200': 'bg-amber-200/20',
    'text-blue-400': 'bg-blue-400/20',
    'text-orange-500': 'bg-orange-500/20',
    'text-purple-300': 'bg-purple-300/20',
    'text-cyan-400': 'bg-cyan-400/20',
    'text-slate-400': 'bg-slate-400/20',
  };
  const textColor = getLoaderColor(name);
  return colorMap[textColor] || 'bg-surface-container-highest';
};

const Mods: React.FC = () => {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('downloads');
  const [contentType, setContentType] = useState<ContentType>('plugins');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedLoader, setSelectedLoader] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(20);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  // Collapsible sections
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [versionOpen, setVersionOpen] = useState(true);
  const [loaderOpen, setLoaderOpen] = useState(true);
  const [platformOpen, setPlatformOpen] = useState(true);

  const fetchMods = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('mods')
      .select('*')
      .eq('status', 'approved');

    // Map content type to category field
    const categoryMap: Record<ContentType, string> = {
      plugins: 'plugin',
      mods: 'mod',
      datapacks: 'datapack',
      resourcepacks: 'resourcepack',
      shaders: 'shader',
      modpacks: 'modpack',
    };
    query = query.eq('category', categoryMap[contentType]);

    if (selectedVersion) {
      query = query.contains('supported_mc_versions', [selectedVersion]);
    }

    if (selectedCategory) {
      const catLabel = CATEGORIES.find(c => c.value === selectedCategory)?.label;
      if (catLabel) {
        query = query.contains('tags', [catLabel]);
      }
    }

    if (selectedLoader) {
      query = query.contains('loaders', [selectedLoader]);
    }

    if (selectedPlatform) {
      query = query.contains('loaders', [selectedPlatform]);
    }

    if (sortBy === 'downloads') {
      query = query.order('downloads', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'updated') {
      query = query.order('updated_at', { ascending: false });
    } else {
      query = query.order('title', { ascending: true });
    }

    query = query.limit(viewCount);

    const { data, error } = await query;
    if (!error && data) setMods(data as Mod[]);
    setLoading(false);
  }, [sortBy, contentType, selectedVersion, selectedCategory, selectedLoader, selectedPlatform, viewCount]);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  const filteredMods = mods.filter((mod) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      mod.title.toLowerCase().includes(q) ||
      mod.author_name.toLowerCase().includes(q) ||
      (mod.subtitle && mod.subtitle.toLowerCase().includes(q)) ||
      mod.description.toLowerCase().includes(q)
    );
  });

  const formatDownloads = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return language === 'it' ? 'Adesso' : 'Now';
    if (hours < 24) return `${hours}h ${language === 'it' ? 'fa' : 'ago'}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${language === 'it' ? 'g fa' : 'd ago'}`;
    if (days < 30) return `${Math.floor(days / 7)} ${language === 'it' ? 'sett. fa' : 'w ago'}`;
    if (days < 365) return `${Math.floor(days / 30)} ${language === 'it' ? 'mesi fa' : 'mo ago'}`;
    return `${Math.floor(days / 365)} ${language === 'it' ? 'anni fa' : 'y ago'}`;
  };

  const currentLoaders = contentType === 'plugins' ? PLUGIN_LOADERS : MOD_LOADERS;
  const displayedVersions = showAllVersions ? MC_VERSIONS : MC_VERSIONS.slice(0, 8);

  // Visibility rules for sidebar cards
  const showLoaders = contentType === 'plugins' || contentType === 'mods' || contentType === 'modpacks';
  const showPlatform = contentType === 'plugins';

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-4 sm:px-margin">
      <div className="pointer-events-none absolute left-[-8rem] top-28 h-72 w-72 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="mx-auto w-full max-w-[1280px]">
        {/* Content type tabs (like Modrinth top bar) */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-2xl border-[3px] border-black bg-surface-container p-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                className={`rounded-xl px-4 py-2 font-label-caps text-[11px] transition-all ${
                  contentType === ct.value
                    ? 'bg-primary-container text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <>
                <Link
                  to="/mods/followed"
                  className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-surface-container-high px-3 py-2 font-label-caps text-[10px] text-on-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">favorite</span>
                  {t('mods.followed_creators')}
                </Link>
                <Link
                  to="/mods/saved"
                  className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-surface-container-high px-3 py-2 font-label-caps text-[10px] text-on-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">bookmark</span>
                  {t('mods.saved_projects')}
                </Link>
                <Link
                  to="/mods/my"
                  className="rounded-xl border-[2px] border-black bg-surface-container-high px-3 py-2 font-label-caps text-[10px] text-on-surface-variant shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                >
                  {t('mods.my_mods')}
                </Link>
              </>
            )}
            <Link
              to="/mods/upload"
              className="inline-flex items-center gap-1.5 rounded-xl border-[2px] border-black bg-tertiary px-4 py-2 font-label-caps text-[11px] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('mods.publish')}
            </Link>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-[300px]">
            <div className="sticky top-24 flex flex-col gap-3">
              {/* Category */}
              <CollapsibleCard title={t('mods.category')} open={categoryOpen} onToggle={() => setCategoryOpen(!categoryOpen)}>
                <div className="flex flex-col gap-0.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body-sm text-[14px] transition-all ${
                        selectedCategory === cat.value
                          ? 'bg-primary-container/20 font-bold text-primary-container'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </CollapsibleCard>

              {/* Game version */}
              <CollapsibleCard title={t('mods.game_version')} open={versionOpen} onToggle={() => setVersionOpen(!versionOpen)}>
                <div className="flex flex-col gap-0.5">
                  {displayedVersions.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedVersion(selectedVersion === v ? null : v)}
                      className={`rounded-lg px-3 py-2 text-left font-body-sm text-[14px] transition-all ${
                        selectedVersion === v
                          ? 'bg-primary-container/20 font-bold text-primary-container'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAllVersions(!showAllVersions)}
                    className="mt-1 flex items-center gap-1 px-3 py-1.5 font-label-caps text-[11px] text-tertiary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[14px]">{showAllVersions ? 'expand_less' : 'expand_more'}</span>
                    {showAllVersions ? t('mods.show_less') : t('mods.show_all_versions')}
                  </button>
                </div>
              </CollapsibleCard>

              {/* Loader */}
              {showLoaders && (
              <CollapsibleCard title={t('mods.loader')} open={loaderOpen} onToggle={() => setLoaderOpen(!loaderOpen)}>
                <div className="flex flex-col gap-0.5">
                  {currentLoaders.map((loader) => (
                    <button
                      key={loader.name}
                      onClick={() => setSelectedLoader(selectedLoader === loader.name ? null : loader.name)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                        selectedLoader === loader.name
                          ? 'bg-surface-container-high'
                          : 'hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="text-[18px]">{loader.icon}</span>
                      <span className={`font-headline-md text-[15px] ${loader.color}`}>{loader.name}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleCard>
              )}

              {/* Platform */}
              {showPlatform && (
              <CollapsibleCard title={t('mods.platform')} open={platformOpen} onToggle={() => setPlatformOpen(!platformOpen)}>
                <div className="flex flex-col gap-0.5">
                  {PLATFORMS.map((platform) => (
                    <button
                      key={platform.name}
                      onClick={() => setSelectedPlatform(selectedPlatform === platform.name ? null : platform.name)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                        selectedPlatform === platform.name
                          ? 'bg-surface-container-high'
                          : 'hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="text-[18px]">{platform.icon}</span>
                      <span className={`font-headline-md text-[15px] ${platform.color}`}>{platform.name}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleCard>
              )}
            </div>
          </aside>

          {/* Content area */}
          <div className="flex-1">
            {/* Search bar */}
            <div className="mb-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('mods.search')}
                  className="w-full rounded-xl border-[2px] border-black/40 bg-surface-container py-3.5 pl-12 pr-4 font-body-sm text-[15px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary-container"
                />
              </div>
            </div>

            {/* Sort bar — separated elements like Modrinth */}
            <div className="mb-5 flex items-center gap-3">
              {/* Sort by dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setSortDropdownOpen(!sortDropdownOpen); setViewDropdownOpen(false); }}
                  className="flex items-center gap-2 rounded-xl border-[2px] border-black/40 bg-surface-container px-4 py-2.5 transition-all hover:border-black/60"
                >
                  <span className="font-label-caps text-[11px] text-on-surface-variant">{t('mods.sort_by')}</span>
                  <span className="font-body-sm text-[14px] text-white font-bold">
                    {sortBy === 'downloads' ? 'Relevance' : sortBy === 'newest' ? 'Newest' : sortBy === 'updated' ? 'Updated' : 'A-Z'}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
                </button>
                {sortDropdownOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-[160px] rounded-xl border-[2px] border-black/40 bg-surface-container p-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {([
                      { value: 'downloads', label: 'Relevance' },
                      { value: 'newest', label: 'Newest' },
                      { value: 'updated', label: 'Updated' },
                      { value: 'title', label: 'A-Z' },
                    ] as { value: SortBy; label: string }[]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); }}
                        className={`w-full rounded-lg px-3 py-2 text-left font-body-sm text-[14px] transition-all ${
                          sortBy === opt.value ? 'bg-primary-container/20 text-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setViewDropdownOpen(!viewDropdownOpen); setSortDropdownOpen(false); }}
                  className="flex items-center gap-2 rounded-xl border-[2px] border-black/40 bg-surface-container px-4 py-2.5 transition-all hover:border-black/60"
                >
                  <span className="font-label-caps text-[11px] text-on-surface-variant">{t('mods.view')}</span>
                  <span className="font-body-sm text-[14px] text-white font-bold">{viewCount}</span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
                </button>
                {viewDropdownOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-[100px] rounded-xl border-[2px] border-black/40 bg-surface-container p-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {VIEW_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => { setViewCount(n); setViewDropdownOpen(false); }}
                        className={`w-full rounded-lg px-3 py-2 text-left font-body-sm text-[14px] transition-all ${
                          viewCount === n ? 'bg-primary-container/20 text-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="ml-auto flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container font-label-caps text-[12px] text-white">1</span>
                <span className="font-body-sm text-[13px] text-on-surface-variant">
                  ... {Math.max(1, Math.ceil(filteredMods.length / viewCount))}
                </span>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Mods list */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
              </div>
            ) : filteredMods.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-black bg-surface-container p-12 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">search_off</span>
                <p className="font-headline-md text-[18px] text-white">{t('mods.no_results')}</p>
                <p className="font-body-sm text-on-surface-variant">{t('mods.no_results.hint')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredMods.map((mod) => (
                  <ModCard key={mod.id} mod={mod} formatDownloads={formatDownloads} formatTimeAgo={formatTimeAgo} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

// Mod card with expandable tags
const ModCard: React.FC<{
  mod: Mod;
  formatDownloads: (n: number) => string;
  formatTimeAgo: (dateStr: string) => string;
}> = ({ mod, formatDownloads, formatTimeAgo }) => {
  const [expanded, setExpanded] = useState(false);

  const allTags = mod.tags || [];
  const allLoaders = mod.loaders || [];
  const allVersions = formatVersionsCompact(mod.supported_mc_versions || []);
  const totalBadges = allTags.length + allLoaders.length + allVersions.length;
  const MAX_VISIBLE = 7;
  const hasOverflow = totalBadges > MAX_VISIBLE;
  const hiddenCount = totalBadges - MAX_VISIBLE;

  // Build visible badges
  const visibleTags = expanded ? allTags : allTags;
  const visibleLoaders = expanded ? allLoaders : allLoaders;
  const visibleVersions = expanded ? allVersions : allVersions;

  // When collapsed, limit total shown
  let shownCount = 0;
  const shouldShow = () => {
    if (expanded) return true;
    shownCount++;
    return shownCount <= MAX_VISIBLE;
  };

  return (
    <div className="group rounded-2xl border-[2px] border-black/40 bg-surface-container transition-all hover:border-black/70 hover:bg-surface-container-high">
      <Link to={`/mods/${mod.id}`} className="flex gap-5 p-6">
        {/* Icon */}
        <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl border-[2px] border-black/40 bg-surface-container-high">
          {mod.icon_url ? (
            <img src={mod.icon_url} alt={mod.title} className="h-full w-full rounded-lg object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
              {mod.category === 'plugin' ? 'extension' : mod.category === 'mod' ? 'build' : 'inventory_2'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <h3 className="truncate font-headline-md text-[18px] text-white group-hover:text-primary-container">{mod.title}</h3>
            <span className="shrink-0 font-body-sm text-[13px] text-on-surface-variant">by {mod.author_name}</span>
          </div>
          <p className="line-clamp-2 font-body-sm text-[14px] text-on-surface-variant leading-relaxed">
            {mod.subtitle || mod.description}
          </p>
          {/* Tags row */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {visibleTags.map((tag) => {
              if (!shouldShow()) return null;
              return (
                <span key={tag} className="rounded-md bg-surface-container-highest px-2.5 py-1 font-label-caps text-[10px] text-on-surface-variant">
                  {tag}
                </span>
              );
            })}
            {visibleLoaders.map((loader) => {
              if (!shouldShow()) return null;
              return (
                <span key={loader} className={`rounded-md px-2.5 py-1 font-label-caps text-[10px] ${getLoaderColor(loader)} ${getLoaderBgColor(loader)}`}>
                  {loader}
                </span>
              );
            })}
            {visibleVersions.map((v) => {
              if (!shouldShow()) return null;
              return (
                <span key={v} className="rounded-md bg-surface-container-highest px-2.5 py-1 font-label-caps text-[10px] text-on-surface-variant">
                  {v}
                </span>
              );
            })}
            {hasOverflow && !expanded && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
                className="rounded-md bg-surface-container-highest px-2.5 py-1 font-label-caps text-[10px] text-tertiary hover:bg-tertiary/20 transition-colors"
              >
                +{hiddenCount}
              </button>
            )}
            {expanded && hasOverflow && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(false); }}
                className="rounded-md bg-surface-container-highest px-2.5 py-1 font-label-caps text-[10px] text-tertiary hover:bg-tertiary/20 transition-colors"
              >
                −
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-body-sm text-[15px] font-bold text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {formatDownloads(mod.downloads)}
            </span>
            <span className="flex items-center gap-1.5 font-body-sm text-[15px] font-bold text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">favorite</span>
              0
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-body-sm text-[14px] text-on-surface-variant/70">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            {formatTimeAgo(mod.updated_at || mod.created_at)}
          </span>
        </div>
      </Link>
    </div>
  );
};

// Collapsible sidebar card
const CollapsibleCard: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, open, onToggle, children }) => (
  <div className="rounded-2xl border-[3px] border-black bg-surface-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-5 py-4"
    >
      <span className="font-headline-md text-[16px] text-white">{title}</span>
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
        expand_more
      </span>
    </button>
    {open && (
      <div className="px-3 pb-4">
        {children}
      </div>
    )}
  </div>
);

export default Mods;
