import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import PageAnimator from '../components/PageAnimator';
import ProfileEditor from '../components/ProfileEditor';

export interface ProfileCustomization {
  id: string;
  minecraft_username: string | null;
  gd_username: string | null;
  display_name: string | null;
  email: string;
  role: 'user' | 'admin';
  admin_rank: 'owner' | 'admin' | 'mod' | 'tier_tester' | null;
  ign_verified: boolean;
  bio: string | null;
  created_at: string;
  banner_url: string | null;
  banner_gradient: string | null;
  accent_color: string;
  name_font: string;
  name_effect: string;
  avatar_shape: string;
  avatar_border_color: string | null;
  avatar_border_animated: boolean;
  card_background: string | null;
  motto: string | null;
  spotify_url: string | null;
  social_links: Record<string, string>;
  interests: string[];
  badges: string[];
  active_badges: string[];
  theme: string;
}

const FONT_CLASSES: Record<string, string> = {
  default: 'font-headline-lg',
  pixel: 'font-mono',
  handwriting: 'italic font-serif',
  bold: 'font-black tracking-tight',
  retro: 'font-headline-md tracking-widest',
};

const SHAPE_CLASSES: Record<string, string> = {
  rounded: 'rounded-2xl',
  circle: 'rounded-full',
  hexagon: 'clip-path-hexagon rounded-none',
  diamond: 'rotate-45 rounded-lg',
};

const Profile: React.FC = () => {
  const { username } = useParams<{ username?: string }>();
  const { profile: myProfile } = useAuth();
  const [profileData, setProfileData] = useState<ProfileCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [playerStats, setPlayerStats] = useState<{ tier: string; points: number; combat_rank: string } | null>(null);

  const isOwnProfile = !username || (myProfile?.minecraft_username === username);
  const canEdit = isOwnProfile || myProfile?.admin_rank === 'owner';

  useEffect(() => {
    const fetchProfile = async () => {
      let query = supabase.from('profiles').select('*');
      if (username) {
        query = query.eq('minecraft_username', username);
      } else if (myProfile) {
        query = query.eq('id', myProfile.id);
      } else {
        setLoading(false);
        return;
      }
      const { data, error } = await query.single();
      if (!error && data) {
        setProfileData(data as unknown as ProfileCustomization);
        // Fetch tierlist stats if applicable
        if (data.minecraft_username) {
          const { data: playerData } = await supabase
            .from('players')
            .select('points, combat_rank')
            .eq('ign', data.minecraft_username)
            .single();
          if (playerData) {
            const { data: overallRank } = await supabase
              .from('player_ranks')
              .select('tier')
              .eq('category', 'OVERALL')
              .eq('player_id', playerData.points) // We need player id
              .single();
            setPlayerStats({ tier: overallRank?.tier || 'N/A', points: playerData.points, combat_rank: playerData.combat_rank });
          }
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [username, myProfile]);

  if (loading) {
    return (
      <PageAnimator className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </PageAnimator>
    );
  }

  if (!profileData) {
    return (
      <PageAnimator className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="font-body-lg text-on-surface-variant">Profilo non trovato.</p>
      </PageAnimator>
    );
  }

  if (editing && canEdit) {
    return <ProfileEditor profileData={profileData} onSave={(updated) => { setProfileData(updated); setEditing(false); }} onCancel={() => setEditing(false)} />;
  }

  const accent = profileData.accent_color || '#2563eb';
  const avatarSrc = profileData.ign_verified
    ? `https://mc-heads.net/avatar/${profileData.minecraft_username}/128`
    : '/profilepng/profile.png';
  const joinDate = new Date(profileData.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  const fontClass = FONT_CLASSES[profileData.name_font] || FONT_CLASSES.default;
  const shapeClass = SHAPE_CLASSES[profileData.avatar_shape] || SHAPE_CLASSES.rounded;

  const bannerStyle: React.CSSProperties = profileData.banner_url
    ? { backgroundImage: `url(${profileData.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : profileData.banner_gradient
      ? { background: profileData.banner_gradient.includes(',') ? `linear-gradient(135deg, ${profileData.banner_gradient})` : profileData.banner_gradient }
      : { background: `linear-gradient(135deg, ${accent}44 0%, ${accent} 50%, ${accent}cc 100%)` };

  const cardStyle: React.CSSProperties = profileData.card_background
    ? profileData.card_background.includes(',')
      ? { background: `linear-gradient(160deg, ${profileData.card_background})` }
      : { background: profileData.card_background }
    : {};

  const nameStyle: React.CSSProperties = profileData.name_effect === 'glow'
    ? { textShadow: `0 0 20px ${accent}, 0 0 40px ${accent}66` }
    : profileData.name_effect === 'gradient'
      ? { background: `linear-gradient(90deg, ${accent}, #fff, ${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
      : {};

  const avatarBorderStyle: React.CSSProperties = profileData.avatar_border_color
    ? { borderColor: profileData.avatar_border_color }
    : { borderColor: accent };

  return (
    <PageAnimator className="min-h-screen px-4 py-8 sm:px-margin">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[2rem] border-[4px] border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]" style={cardStyle}>
          {/* Banner */}
          <div className="relative h-36 sm:h-44" style={bannerStyle}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="absolute right-4 top-4 flex items-center gap-1 rounded-xl border-[3px] border-black bg-surface-container/80 px-3 py-2 font-label-caps text-[10px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] backdrop-blur-sm transition-all hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[16px]">palette</span>
                PERSONALIZZA
              </button>
            )}
          </div>

          {/* Content */}
          <div className="relative bg-surface-container px-6 pb-8 sm:px-8">
            {/* Avatar */}
            <div className="-mt-14 flex flex-col items-center sm:flex-row sm:items-end sm:gap-6">
              <div className={`relative ${profileData.avatar_border_animated ? 'animate-border-rainbow' : ''}`}>
                <img
                  src={avatarSrc}
                  alt={profileData.minecraft_username || ''}
                  className={`h-28 w-28 border-[4px] bg-surface-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] ${shapeClass} ${profileData.avatar_shape === 'diamond' ? 'h-20 w-20' : ''}`}
                  style={avatarBorderStyle}
                />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h1
                  className={`${fontClass} text-[32px] uppercase leading-none text-white sm:text-[40px] ${profileData.name_effect === 'pulse' ? 'animate-pulse' : ''}`}
                  style={nameStyle}
                >
                  {profileData.display_name || profileData.minecraft_username}
                </h1>
                {profileData.motto && (
                  <p className="mt-1 font-body-sm text-[13px] italic text-on-surface-variant">"{profileData.motto}"</p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-lg border-2 px-2 py-0.5 font-label-caps text-[10px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ borderColor: accent, backgroundColor: `${accent}33`, color: accent }}>
                    {(profileData.admin_rank || profileData.role).toUpperCase()}
                  </span>
                  {!profileData.ign_verified && (
                    <span className="rounded-lg border border-yellow-500 bg-yellow-500/20 px-2 py-0.5 font-label-caps text-[10px] text-yellow-400">NON VERIFICATO</span>
                  )}
                  {profileData.active_badges?.slice(0, 3).map((badge) => (
                    <span key={badge} className="rounded-lg border-2 border-black px-2 py-0.5 font-label-caps text-[9px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: accent }}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Social Links */}
            {profileData.social_links && Object.keys(profileData.social_links).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(profileData.social_links).map(([platform, url]) => url && (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border-2 border-black px-3 py-1.5 font-label-caps text-[10px] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: `${accent}44` }}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {platform === 'youtube' ? 'play_circle' : platform === 'twitch' ? 'videocam' : platform === 'discord' ? 'chat' : platform === 'instagram' ? 'photo_camera' : platform === 'tiktok' ? 'music_note' : 'link'}
                    </span>
                    {platform}
                  </a>
                ))}
              </div>
            )}

            {/* Bio */}
            {profileData.bio && (
              <div className="mt-5 rounded-2xl border-[3px] border-black p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: `${accent}11`, borderColor: `${accent}66` }}>
                <p className="font-body-sm text-on-surface whitespace-pre-wrap">{profileData.bio}</p>
              </div>
            )}

            {/* Interests */}
            {profileData.interests && profileData.interests.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 font-label-caps text-[11px] text-on-surface-variant">INTERESSI</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.interests.map((interest) => (
                    <span key={interest} className="rounded-lg border-2 border-black px-2.5 py-1 font-label-caps text-[9px] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: `${accent}55` }}>
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border-[3px] border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: `${accent}15` }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>calendar_month</span>
                <p className="mt-1 font-label-caps text-[9px] text-on-surface-variant">MEMBRO DAL</p>
                <p className="font-headline-md text-[13px] text-white">{joinDate}</p>
              </div>
              {playerStats && (
                <>
                  <div className="rounded-xl border-[3px] border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: `${accent}15` }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>emoji_events</span>
                    <p className="mt-1 font-label-caps text-[9px] text-on-surface-variant">COMBAT RANK</p>
                    <p className="font-headline-md text-[13px] text-white">{playerStats.combat_rank}</p>
                  </div>
                  <div className="rounded-xl border-[3px] border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: `${accent}15` }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>star</span>
                    <p className="mt-1 font-label-caps text-[9px] text-on-surface-variant">PUNTI TOTALI</p>
                    <p className="font-headline-md text-[13px] text-white">{playerStats.points}</p>
                  </div>
                </>
              )}
            </div>

            {/* Spotify */}
            {profileData.spotify_url && (
              <div className="mt-5">
                <iframe
                  src={profileData.spotify_url.replace('open.spotify.com/', 'open.spotify.com/embed/').split('?')[0]}
                  width="100%"
                  height="80"
                  allow="encrypted-media"
                  className="rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

export default Profile;
