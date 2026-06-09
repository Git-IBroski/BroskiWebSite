import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const IdeaSubmit: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  // Blocca invio idee se IGN non verificato
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
              Il tuo Minecraft username deve essere verificato da un Owner prima di poter inviare idee.
            </p>
            <Link
              to="/progetti"
              className="w-full rounded-2xl border-[3px] border-black bg-surface-bright px-6 py-3 text-center font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1"
            >
              TORNA AI PROGETTI
            </Link>
          </div>
        </div>
      </PageAnimator>
    );
  }
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showTitleEmoji, setShowTitleEmoji] = useState(false);
  const [showContentEmoji, setShowContentEmoji] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const COMMON_EMOJIS = ['😀','😂','🔥','❤️','⭐','🎮','⚡','🏆','💎','🎯','🚀','💡','🎉','👑','🗡️','⚔️','🛡️','🏰','🌍','✨','👍','🤔','😎','🤯','💪','🙌','📢','🎵','🌟','💥'];

  const insertEmojiChar = (emoji: string, ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, setter: React.Dispatch<React.SetStateAction<string>>, max: number) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    setter((prev) => {
      const newVal = prev.slice(0, start) + emoji + prev.slice(end);
      return newVal.slice(0, max);
    });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user || !profile) { setError(t('idea.error.login')); return; }
    if (!title.trim()) { setError(t('idea.error.title')); return; }
    if (!content.trim()) { setError(t('idea.error.content')); return; }
    if (rating === 0) { setError(t('idea.error.rating')); return; }

    setLoading(true);
    try {
      const { error: insertErr } = await supabase.from('ideas').insert({
        author_id: user.id,
        author_name: profile.minecraft_username || profile.email,
        title: title.trim().slice(0, 50),
        content: content.trim().slice(0, 1000),
        rating,
      });
      if (insertErr) throw new Error(insertErr.message);
      setSuccess(true);
      setTimeout(() => navigate('/progetti'), 2500);
    } catch (err: any) {
      setError(err.message || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PageAnimator className="flex min-h-[calc(100vh-76px)] flex-col items-center justify-center gap-4 px-4">
        <span className="material-symbols-outlined text-[72px] text-tertiary">check_circle</span>
        <h2 className="font-headline-md text-[24px] text-white">{t('idea.success.title')}</h2>
        <p className="font-body-sm text-on-surface-variant text-center max-w-md">{t('idea.success.desc')}</p>
      </PageAnimator>
    );
  }

  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-tertiary/15 blur-3xl" />
      <div className="relative z-10 mx-auto w-full max-w-[700px]">
        <Link to="/progetti"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border-[2px] border-black bg-surface-container-high px-4 py-2 font-label-caps text-[11px] text-on-surface-variant shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('idea.back')}
        </Link>

        <div className="mb-8">
          <div className="mb-3 inline-flex -rotate-2 items-center gap-2 rounded-2xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            {t('idea.badge')}
          </div>
          <h1 className="font-headline-lg text-[36px] uppercase leading-none tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[52px]">
            {t('idea.title')}
          </h1>
          <p className="mt-2 font-body-sm text-on-surface-variant">{t('idea.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Title */}
          <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">{t('idea.field.title')} (MAX 50)</label>
            <div className="flex items-center gap-2">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                maxLength={50}
                placeholder={t('idea.field.title_placeholder')}
                className="flex-1 rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-[15px] text-on-surface placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container"
              />
              <button
                type="button"
                onClick={() => { setShowTitleEmoji(!showTitleEmoji); setShowContentEmoji(false); }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[2px] border-black bg-surface-container-high shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
              >
                <span className="text-[20px]">😀</span>
              </button>
            </div>
            {showTitleEmoji && (
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border-[2px] border-black/40 bg-surface-container-high p-3">
                {COMMON_EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmojiChar(e, titleRef, setTitle, 50)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] hover:bg-surface-container-highest transition-colors">{e}</button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-right font-label-caps text-[9px] text-on-surface-variant/50">{title.length}/50</p>
          </div>

          {/* Content */}
          <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <label className="mb-2 block font-label-caps text-[11px] text-on-surface-variant">{t('idea.field.content')} (MAX 1000)</label>
            <div className="flex gap-2">
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={6}
                placeholder={t('idea.field.content_placeholder')}
                className="flex-1 rounded-2xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-[15px] text-on-surface placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:border-primary-container resize-y"
              />
              <button
                type="button"
                onClick={() => { setShowContentEmoji(!showContentEmoji); setShowTitleEmoji(false); }}
                className="flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-xl border-[2px] border-black bg-surface-container-high shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5"
              >
                <span className="text-[20px]">😀</span>
              </button>
            </div>
            {showContentEmoji && (
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border-[2px] border-black/40 bg-surface-container-high p-3">
                {COMMON_EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmojiChar(e, contentRef, setContent, 1000)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] hover:bg-surface-container-highest transition-colors">{e}</button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-right font-label-caps text-[9px] text-on-surface-variant/50">{content.length}/1000</p>
          </div>

          {/* Rating */}
          <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <label className="mb-3 block font-label-caps text-[11px] text-on-surface-variant">{t('idea.field.rating')}</label>
            <p className="mb-4 font-body-sm text-[13px] text-on-surface-variant/70">{t('idea.field.rating_desc')}</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-125"
                >
                  <span className={`material-symbols-outlined text-[36px] ${
                    star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-on-surface-variant/30'
                  }`}>
                    {star <= (hoverRating || rating) ? 'star' : 'star_border'}
                  </span>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-3 font-headline-md text-[16px] text-yellow-400">{rating}/5</span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[4px] border-black bg-tertiary px-6 py-4 font-headline-md text-[18px] text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60">
            <span className="material-symbols-outlined text-[24px]">send</span>
            {loading ? t('idea.submitting') : t('idea.submit')}
          </button>
        </form>
      </div>
    </PageAnimator>
  );
};

export default IdeaSubmit;
