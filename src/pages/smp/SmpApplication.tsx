import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import TransitionLink from '../../components/TransitionLink';
import PageAnimator from '../../components/PageAnimator';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { pick, pickOptions } from './smpTypes';
import type { SmpAnswer, SmpInfo, SmpQuestion } from './smpTypes';

interface SmpApplicationProps {
  base: string;
}

type AnswerValue = string | string[] | boolean | null;

// SMP-specific UI copy (the global t() dictionary doesn't cover these).
const UI = {
  it: {
    badge: 'CANDIDATURA',
    title: 'Entra in BroskiSMP',
    subtitle: 'Rispondi alle domande qui sotto per richiedere un invito.',
    loading: 'Caricamento…',
    login_required: 'Login richiesto',
    login_desc: 'Ti serve un account Broski per candidarti alla SMP.',
    login_cta: 'Accedi / Registrati',
    closed_title: 'Candidature chiuse',
    closed_desc: 'Ripassa più tardi o entra nel nostro Discord per gli aggiornamenti.',
    submitted_title: 'Candidatura inviata!',
    submitted_desc: 'Il nostro team la esaminerà presto. Verrai contattato via Discord.',
    back_home: 'Torna alla home',
    pending_title: 'Candidatura in attesa',
    pending_desc: 'Hai già una candidatura in revisione. Attendi una risposta.',
    no_questions: 'Non ci sono ancora domande impostate. Ripassa più tardi.',
    answer_placeholder: 'Scrivi la tua risposta…',
    yes: 'Sì',
    no: 'No',
    please_answer: (l: string) => `Rispondi a: "${l}"`,
    bad_url: (l: string, p: string) => `Il link per "${l}" deve iniziare con "${p}".`,
    url_hint: (p: string) => `Deve iniziare con ${p}`,
    submit: 'Invia candidatura',
    submitting: 'Invio…',
  },
  en: {
    badge: 'APPLICATION',
    title: 'Apply to BroskiSMP',
    subtitle: 'Answer the questions below to request an invite.',
    loading: 'Loading…',
    login_required: 'Login required',
    login_desc: 'You need a Broski account to apply to the SMP.',
    login_cta: 'Login / Sign up',
    closed_title: 'Applications are closed',
    closed_desc: 'Check back later or join our Discord for updates.',
    submitted_title: 'Application submitted!',
    submitted_desc: "Our team will review it soon. You'll be contacted via Discord.",
    back_home: 'Back to home',
    pending_title: 'Application pending',
    pending_desc: 'You already have an application under review. Please wait for a response.',
    no_questions: 'No questions have been set up yet. Please check back later.',
    answer_placeholder: 'Type your answer…',
    yes: 'Yes',
    no: 'No',
    please_answer: (l: string) => `Please answer: "${l}"`,
    bad_url: (l: string, p: string) => `The link for "${l}" must start with "${p}".`,
    url_hint: (p: string) => `Must start with ${p}`,
    submit: 'Submit application',
    submitting: 'Submitting…',
  },
};

const SmpApplication: React.FC<SmpApplicationProps> = ({ base }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const ui = UI[language];
  const [questions, setQuestions] = useState<SmpQuestion[]>([]);
  const [info, setInfo] = useState<SmpInfo | null>(null);
  const [values, setValues] = useState<Record<string, AnswerValue>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyPending, setAlreadyPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: qData }, { data: infoData }] = await Promise.all([
        supabase.from('smp_application_questions').select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('smp_info').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setQuestions((qData as SmpQuestion[]) ?? []);
      setInfo((infoData as SmpInfo) ?? null);
      setLoading(false);
    };
    load();
  }, []);

  // Check for an existing pending application once we know the user.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('smp_applications')
      .select('id')
      .eq('applicant_id', user.id)
      .eq('status', 'pending')
      .limit(1)
      .then(({ data }) => setAlreadyPending(!!data && data.length > 0));
  }, [user]);

  const setValue = (id: string, v: AnswerValue) => setValues((prev) => ({ ...prev, [id]: v }));

  const toggleCheckbox = (id: string, option: string) => {
    setValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      return {
        ...prev,
        [id]: current.includes(option) ? current.filter((o) => o !== option) : [...current, option],
      };
    });
  };

  const applicationsOpen = info?.applications_open !== false;

  const isMissing = (q: SmpQuestion): boolean => {
    if (!q.required) return false;
    const v = values[q.id];
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  };

  const firstMissing = useMemo(() => questions.find(isMissing), [questions, values]);

  // A url question is invalid when its (non-empty) value doesn't start with the required prefix.
  const urlError = (q: SmpQuestion): boolean => {
    if (q.type !== 'url' || !q.url_prefix) return false;
    const v = values[q.id];
    if (typeof v !== 'string' || v.trim() === '') return false; // emptiness handled by required check
    return !v.trim().startsWith(q.url_prefix);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!user) return;
    if (firstMissing) {
      setError(ui.please_answer(pick(language, firstMissing.label, firstMissing.label_en)));
      return;
    }
    const badUrl = questions.find(urlError);
    if (badUrl && badUrl.url_prefix) {
      setError(ui.bad_url(pick(language, badUrl.label, badUrl.label_en), badUrl.url_prefix));
      return;
    }
    setSubmitting(true);
    // Snapshot answers with the label in the language the applicant used.
    const answers: SmpAnswer[] = questions.map((q) => ({
      question_id: q.id,
      label: pick(language, q.label, q.label_en),
      type: q.type,
      value: (values[q.id] ?? null) as SmpAnswer['value'],
    }));

    const { error: insertError } = await supabase.from('smp_applications').insert({
      applicant_id: user.id,
      applicant_name: profile?.minecraft_username ?? profile?.display_name ?? null,
      answers,
      status: 'pending',
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSubmitted(true);
  };

  const renderField = (q: SmpQuestion) => {
    const v = values[q.id];
    const options = pickOptions(language, q);
    const inputClass =
      'w-full rounded-xl border-[3px] border-black bg-surface-container-high px-4 py-3 font-body-sm text-white placeholder:text-on-surface-variant/50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:-translate-y-0.5 transition-transform';

    switch (q.type) {
      case 'textarea':
        return (
          <textarea
            rows={5}
            value={(v as string) ?? ''}
            onChange={(e) => setValue(q.id, e.target.value)}
            className={inputClass}
            placeholder={ui.answer_placeholder}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={(v as string) ?? ''}
            onChange={(e) => setValue(q.id, e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        );
      case 'multiple_choice':
        return (
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-[3px] border-black px-4 py-3 font-body-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
                  v === opt ? 'bg-tertiary text-white -translate-y-0.5' : 'bg-surface-container-high text-on-surface-variant hover:-translate-y-0.5'
                }`}
              >
                <input type="radio" name={q.id} checked={v === opt} onChange={() => setValue(q.id, opt)} className="accent-tertiary" />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const checked = Array.isArray(v) && v.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-[3px] border-black px-4 py-3 font-body-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
                    checked ? 'bg-tertiary text-white -translate-y-0.5' : 'bg-surface-container-high text-on-surface-variant hover:-translate-y-0.5'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(q.id, opt)} className="accent-tertiary" />
                  {opt}
                </label>
              );
            })}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex gap-3">
            {[{ label: ui.yes, val: true }, { label: ui.no, val: false }].map(({ label, val }) => (
              <button
                key={label}
                type="button"
                onClick={() => setValue(q.id, val)}
                className={`flex-1 rounded-xl border-[3px] border-black px-4 py-3 font-headline-md uppercase tracking-tighter shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all ${
                  v === val ? 'bg-tertiary text-white -translate-y-0.5' : 'bg-surface-container-high text-on-surface-variant hover:-translate-y-0.5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        );
      case 'url': {
        const raw = ((v as string) ?? '').trim();
        const invalid = !!q.url_prefix && raw !== '' && !raw.startsWith(q.url_prefix);
        return (
          <div>
            <input
              type="url"
              inputMode="url"
              value={(v as string) ?? ''}
              onChange={(e) => setValue(q.id, e.target.value)}
              className={`${inputClass} ${invalid ? 'border-red-500' : ''}`}
              placeholder={q.url_prefix || 'https://…'}
            />
            {q.url_prefix && (
              <p className={`mt-2 font-body-sm text-[12px] ${invalid ? 'text-red-400' : 'text-on-surface-variant'}`}>
                <span className="material-symbols-outlined align-middle text-[15px]">{invalid ? 'error' : 'link'}</span>{' '}
                {invalid ? ui.bad_url(pick(language, q.label, q.label_en), q.url_prefix) : ui.url_hint(q.url_prefix)}
              </p>
            )}
          </div>
        );
      }
      case 'text':
      default:
        return (
          <input
            type="text"
            value={(v as string) ?? ''}
            onChange={(e) => setValue(q.id, e.target.value)}
            className={inputClass}
            placeholder={ui.answer_placeholder}
          />
        );
    }
  };

  const card = 'rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8';

  return (
    <PageAnimator className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      {/* Decorative blobs, on-brand */}
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute right-[-9rem] top-[32rem] h-80 w-80 rounded-full bg-red-500/15 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="relative overflow-hidden rounded-[2rem] border-[4px] border-black bg-blue-600 p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:bg-blue-900">
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 2px, transparent 2px)', backgroundSize: '26px 26px', opacity: 0.4 }}
          />
          <div className="relative z-10">
            <div className="mb-4 inline-flex -rotate-2 items-center gap-2 rounded-2xl border-[3px] border-black bg-yellow-400 px-4 py-2 font-label-caps text-label-caps text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="material-symbols-outlined text-[18px]">edit_document</span>
              {ui.badge}
            </div>
            <h1 className="font-headline-lg text-[36px] uppercase leading-none tracking-tighter text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] md:text-[52px]">
              {ui.title}
            </h1>
            <p className="mt-3 font-body-lg text-white/90">{ui.subtitle}</p>
          </div>
        </header>

        {/* States */}
        {authLoading || loading ? (
          <div className={`${card} text-center font-headline-md text-white`}>{ui.loading}</div>
        ) : !user ? (
          <div className={`${card} flex flex-col items-center gap-4 text-center`}>
            <span className="material-symbols-outlined text-[48px] text-tertiary">lock</span>
            <h2 className="font-headline-md text-[24px] uppercase text-white">{ui.login_required}</h2>
            <p className="font-body-sm text-on-surface-variant">{ui.login_desc}</p>
            <TransitionLink
              to={`${base}/signin`}
              className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-red-500 px-6 py-3 font-headline-md uppercase tracking-tighter text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-red-400 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {ui.login_cta}
            </TransitionLink>
          </div>
        ) : !applicationsOpen ? (
          <div className={`${card} flex flex-col items-center gap-4 text-center`}>
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant">lock</span>
            <h2 className="font-headline-md text-[24px] uppercase text-white">{ui.closed_title}</h2>
            <p className="font-body-sm text-on-surface-variant">{ui.closed_desc}</p>
          </div>
        ) : submitted ? (
          <div className={`${card} flex flex-col items-center gap-4 text-center`}>
            <span className="material-symbols-outlined text-[48px] text-green-400">check_circle</span>
            <h2 className="font-headline-md text-[24px] uppercase text-white">{ui.submitted_title}</h2>
            <p className="font-body-sm text-on-surface-variant">{ui.submitted_desc}</p>
            <TransitionLink
              to={base || '/'}
              className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-tertiary px-6 py-3 font-headline-md uppercase tracking-tighter text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {ui.back_home}
            </TransitionLink>
          </div>
        ) : alreadyPending ? (
          <div className={`${card} flex flex-col items-center gap-4 text-center`}>
            <span className="material-symbols-outlined text-[48px] text-yellow-400">hourglass_top</span>
            <h2 className="font-headline-md text-[24px] uppercase text-white">{ui.pending_title}</h2>
            <p className="font-body-sm text-on-surface-variant">{ui.pending_desc}</p>
          </div>
        ) : questions.length === 0 ? (
          <div className={`${card} text-center font-body-sm text-on-surface-variant`}>
            {ui.no_questions}
          </div>
        ) : (
          <>
            {questions.map((q, i) => (
              <div key={q.id} className={card}>
                <label className="mb-1 flex items-start gap-2 font-headline-md text-[18px] text-white">
                  <span className="text-tertiary">{i + 1}.</span>
                  <span>
                    {pick(language, q.label, q.label_en)}
                    {q.required && <span className="ml-1 text-red-400">*</span>}
                  </span>
                </label>
                {pick(language, q.helper, q.helper_en) && (
                  <p className="mb-3 font-body-sm text-[13px] text-on-surface-variant">{pick(language, q.helper, q.helper_en)}</p>
                )}
                <div className="mt-3">{renderField(q)}</div>
              </div>
            ))}

            {error && (
              <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-2xl border-[4px] border-black bg-yellow-400 px-6 py-4 font-headline-md text-[20px] uppercase tracking-tighter text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              <span className="material-symbols-outlined">send</span>
              {submitting ? ui.submitting : ui.submit}
            </button>
          </>
        )}
      </div>
    </PageAnimator>
  );
};

export default SmpApplication;
