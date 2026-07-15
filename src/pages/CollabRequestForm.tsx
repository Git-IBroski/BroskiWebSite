import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';
import { LINKS_CONFIG } from '../config/linksConfig';

/** UUID v4 regex for basic client-side token format validation. */
const UUID4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; webhookId: string }
  | { kind: 'missing_id' }
  | { kind: 'submitting' }
  | { kind: 'success'; collabId: number }
  | { kind: 'error'; message: string };

const CollabRequestForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  // Form fields
  const [description, setDescription] = useState('');
  const [eta, setEta] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [tosAccepted, setTosAccepted] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || !UUID4_RE.test(id.trim())) {
      setPageState({ kind: 'missing_id' });
      return;
    }
    setPageState({ kind: 'ready', webhookId: id.trim() });
  }, [searchParams]);

  const handleSubmit = async () => {
    if (pageState.kind !== 'ready') return;
    if (!tosAccepted) return;
    if (submittingRef.current) return;
    submittingRef.current = true;

    setPageState({ kind: 'submitting' });

    try {
      const resp = await fetch('/api/collab-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_id: pageState.webhookId,
          description: description.trim(),
          eta: eta.trim(),
          people_count: peopleCount,
        }),
      });

      const data = await resp.json();

      if (resp.ok && data.success) {
        setPageState({ kind: 'success', collabId: data.collab_id });
      } else {
        setPageState({ kind: 'error', message: data.message || 'Errore sconosciuto.' });
      }
    } catch {
      setPageState({ kind: 'error', message: 'Impossibile contattare il server. Riprova più tardi.' });
    } finally {
      submittingRef.current = false;
    }
  };

  const canSubmit =
    pageState.kind === 'ready' &&
    description.trim().length >= 10 &&
    tosAccepted;

  // ── Loading ────────────────────────────────────────────────────────────
  if (pageState.kind === 'loading') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="flex h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </PageAnimator>
    );
  }

  // ── Missing ID ──────────────────────────────────────────────────────────
  if (pageState.kind === 'missing_id') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-error-container/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
            <div className="absolute inset-0 bg-surface-container-lowest" style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)',
              backgroundSize: '24px 24px',
              opacity: 0.4,
            }} />
            <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-error-container opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-error-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl text-on-error-container">link_off</span>
              </div>
              <h1 className="font-headline-lg text-[28px] uppercase leading-none text-error drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px]">
                LINK NON VALIDO
              </h1>
              <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-body-sm font-bold text-on-surface-variant leading-relaxed">
                  Torna su Discord e clicca di nuovo il pulsante &quot;Request Collab&quot; per ricevere un link valido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────
  if (pageState.kind === 'success') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
            <div className="absolute inset-0 bg-surface-container-lowest" style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)',
              backgroundSize: '24px 24px',
              opacity: 0.4,
            }} />
            <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-green-500 opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-green-500 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl text-white">check_circle</span>
              </div>
              <h1 className="font-headline-lg text-[28px] uppercase leading-none text-green-400 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px]">
                RICHIESTA INVIATA!
              </h1>
              <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-body-sm font-bold text-on-surface-variant leading-relaxed">
                  La tua richiesta di collaborazione è stata inviata con successo!<br /><br />
                  Un moderatore la esaminerà a breve. Riceverai un DM su Discord quando sarà approvata.
                </p>
              </div>
              <a
                href={LINKS_CONFIG.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-2xl border-[4px] border-black bg-[#5865F2] px-6 py-4 text-center font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                TORNA SU DISCORD
              </a>
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (pageState.kind === 'error') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-error-container/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
            <div className="absolute inset-0 bg-surface-container-lowest" style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)',
              backgroundSize: '24px 24px',
              opacity: 0.4,
            }} />
            <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-error-container opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black bg-error-container shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl text-on-error-container">error</span>
              </div>
              <h1 className="font-headline-lg text-[28px] uppercase leading-none text-error drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px]">
                ERRORE
              </h1>
              <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-body-sm font-bold text-on-surface-variant leading-relaxed">
                  {pageState.message}
                </p>
              </div>
              <button
                onClick={() => {
                  if (pageState.kind === 'error') {
                    setPageState((prev) =>
                      prev.kind === 'error'
                        ? { kind: 'ready', webhookId: searchParams.get('id') || '' }
                        : prev
                    );
                  }
                }}
                className="w-full rounded-2xl border-[4px] border-black bg-primary-container px-6 py-4 font-headline-md text-[18px] text-on-primary-container shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                RIPROVA
              </button>
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Submitting ──────────────────────────────────────────────────────────
  if (pageState.kind === 'submitting') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
            <div className="absolute inset-0 bg-surface-container-lowest" style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)',
              backgroundSize: '24px 24px',
              opacity: 0.4,
            }} />
            <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-[#5865F2] opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="flex h-10 w-10 animate-spin rounded-full border-4 border-[#5865F2] border-t-transparent" />
              <h1 className="font-headline-lg text-[28px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px]">
                INVIO IN CORSO...
              </h1>
              <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-body-sm font-bold text-on-surface-variant leading-relaxed">
                  La tua richiesta sta per essere inviata ai moderatori. Attendi un momento...
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-primary-container/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] bottom-24 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:p-8">
          <div className="absolute inset-0 bg-surface-container-lowest" style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2px)',
            backgroundSize: '24px 24px',
            opacity: 0.4,
          }} />
          <div className="absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black bg-[#5865F2] opacity-80" />
          <div className="absolute -left-10 bottom-8 hidden h-28 w-28 rotate-45 rounded-3xl border-4 border-black bg-tertiary opacity-70 md:block" />

          <div className="relative z-10 flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-[#5865F2] shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <span className="material-symbols-outlined text-3xl text-white">groups</span>
              </div>
              <h1 className="font-headline-lg text-[28px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px]">
                RICHIEDI COLLAB
              </h1>
              <p className="font-body-sm font-bold text-on-surface-variant">
                Compila il form per richiedere una collaborazione pubblica. Un moderatore esaminerà la tua richiesta.
              </p>
            </div>

            {/* Form fields */}
            <div className="flex flex-col gap-4">
              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                  Descrizione <span className="text-error">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrivi la tua collaborazione (minimo 10 caratteri)..."
                  maxLength={1000}
                  rows={4}
                  className="w-full resize-none rounded-2xl border-[3px] border-black bg-surface-container-lowest px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-[#5865F2] focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                />
                <span className="font-label-caps text-[10px] text-on-surface-variant/60 text-right">
                  {description.length}/1000
                </span>
              </div>

              {/* ETA */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                  Durata Stimata (ETA)
                </label>
                <input
                  type="text"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  placeholder="es. 1 ora, 30 minuti, 2 giorni..."
                  maxLength={100}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-lowest px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-[#5865F2] focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              {/* People count */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">
                  Numero di Persone <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={300}
                  className="w-full rounded-2xl border-[3px] border-black bg-surface-container-lowest px-4 py-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-[#5865F2] focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              {/* ToS Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded-lg border-[3px] border-black accent-[#5865F2] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                />
                <span className="font-body-sm font-bold text-on-surface-variant leading-relaxed group-hover:text-on-surface transition-colors">
                  Accetto i{' '}
                  <a
                    href="https://ibroski.net/tou"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#5865F2] underline hover:no-underline"
                  >
                    Termini di Servizio
                  </a>
                  {' '}delle collaborazioni e confermo di aver letto le regole.
                </span>
              </label>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-2xl border-[4px] border-black bg-[#5865F2] px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {tosAccepted ? 'INVIA RICHIESTA' : 'ACCETTA I ToS PER CONTINUARE'}
            </button>

            <p className="font-label-caps text-[10px] text-on-surface-variant/60 text-center">
              La tua richiesta sarà esaminata da un moderatore.<br />
              Riceverai un DM su Discord con l'esito.
            </p>
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

export default CollabRequestForm;
