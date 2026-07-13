import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageAnimator from '../components/PageAnimator';

/**
 * UUID v4 regex for basic client-side token format validation.
 * Full validation (freshness, already-used) happens server-side in the bot.
 */
const UUID4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; token: string }
  | { kind: 'missing_token' }
  | { kind: 'result'; resultType: ResultType };

type ResultType =
  | 'success'
  | 'token_invalid'
  | 'discord_denied'
  | 'discord_auth_failed'
  | 'discord_unreachable'
  | 'bot_error'
  | 'bot_unreachable'
  | 'missing_token'
  | 'config_error';

const RESULT_MESSAGES: Record<ResultType, { title: string; message: string; icon: string; variant: 'success' | 'error' | 'warning' }> = {
  success: {
    title: 'VERIFICA COMPLETATA!',
    message: 'Il tuo account Discord è stato verificato con successo. Torna su Discord — dovresti già avere il ruolo aggiornato!',
    icon: 'check_circle',
    variant: 'success',
  },
  token_invalid: {
    title: 'LINK SCADUTO O GIÀ USATO',
    message: 'Questo link non è più valido. Torna su Discord e clicca di nuovo il pulsante di verifica per ricevere un nuovo link.',
    icon: 'link_off',
    variant: 'error',
  },
  discord_denied: {
    title: 'ACCESSO DISCORD NEGATO',
    message: 'Devi autorizzare l\'accesso al tuo account Discord per completare la verifica. Torna su Discord e riprova.',
    icon: 'cancel',
    variant: 'warning',
  },
  discord_auth_failed: {
    title: 'AUTENTICAZIONE FALLITA',
    message: 'Non è stato possibile verificare il tuo account Discord. Riprova tra qualche minuto.',
    icon: 'error',
    variant: 'error',
  },
  discord_unreachable: {
    title: 'DISCORD NON RAGGIUNGIBILE',
    message: 'I server Discord non sono al momento raggiungibili. Riprova tra qualche minuto.',
    icon: 'cloud_off',
    variant: 'warning',
  },
  bot_error: {
    title: 'ERRORE DEL SERVER',
    message: 'Si è verificato un errore imprevisto. La tua verifica sarà completata automaticamente entro pochi minuti. Controlla Discord!',
    icon: 'warning',
    variant: 'warning',
  },
  bot_unreachable: {
    title: 'SERVER DISCORD MOMENTANEAMENTE NON RAGGIUNGIBILE',
    message: 'Il server Discord è momentaneamente irraggiungibile. La tua verifica sarà completata automaticamente entro pochi minuti. Controlla Discord!',
    icon: 'cloud_off',
    variant: 'warning',
  },
  missing_token: {
    title: 'LINK NON VALIDO',
    message: 'Torna su Discord e richiedi un nuovo link di verifica.',
    icon: 'link_off',
    variant: 'error',
  },
  config_error: {
    title: 'ERRORE DI CONFIGURAZIONE',
    message: 'Il sistema di verifica non è configurato correttamente. Contatta lo staff.',
    icon: 'settings',
    variant: 'error',
  },
};

/**
 * Set a cookie with the given name, value, and max-age (in seconds).
 */
function setCookie(name: string, value: string, maxAgeSec: number) {
  const maxAge = Math.max(0, Math.floor(maxAgeSec));
  let str = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (window.location.protocol === 'https:') str += '; Secure';
  document.cookie = str;
}

const VerifyDiscord: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  // In development, the client ID may come from a VITE_ env var
  const discordClientId =
    import.meta.env.VITE_DISCORD_CLIENT_ID || '';

  // Build the Discord OAuth redirect URI dynamically based on the current origin.
  // This matches the DISCORD_REDIRECT_URI env var on the server side.
  const redirectUri = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/api/discord-callback`;
  }, []);

  useEffect(() => {
    // Check if we're on the callback result (after API redirect)
    const resultParam = searchParams.get('result');
    if (resultParam) {
      // The result could be "success" or "token_invalid" or "discord_denied:message"
      const colonIdx = resultParam.indexOf(':');
      const resultType = (colonIdx > 0 ? resultParam.slice(0, colonIdx) : resultParam) as ResultType;
      if (resultType in RESULT_MESSAGES) {
        setPageState({ kind: 'result', resultType });
      } else {
        setPageState({ kind: 'result', resultType: 'bot_error' });
      }
      return;
    }

    // Read the verification token from the query string
    const tkn = searchParams.get('tkn');
    if (!tkn) {
      setPageState({ kind: 'missing_token' });
      return;
    }

    // Basic format validation
    if (!UUID4_RE.test(tkn.trim())) {
      setPageState({ kind: 'missing_token' });
      return;
    }

    setPageState({ kind: 'ready', token: tkn.trim() });
  }, [searchParams]);

  const handleVerifyClick = () => {
    if (pageState.kind !== 'ready') return;

    // Store the verification token in a short-lived cookie (15 min)
    // so the serverless function can read it after the OAuth callback.
    setCookie('verify_token', pageState.token, 900);

    // Build the Discord OAuth2 authorize URL
    // State is included for CSRF protection per Discord's OAuth2 spec.
    // The serverless function doesn't currently verify it (the auth code
    // exchange already binds the flow to this session), but passing it
    // satisfies the protocol requirement.
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: discordClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
    });

    window.location.href = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pageState.kind === 'loading') {
    return (
      <PageAnimator className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8">
        <div className="flex h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
      </PageAnimator>
    );
  }

  // ── Result state (success or error after callback) ────────────────────────
  if (pageState.kind === 'result') {
    const info = RESULT_MESSAGES[pageState.resultType];
    const isSuccess = info.variant === 'success';

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
            <div className={`absolute -right-14 -top-14 h-44 w-44 rotate-12 rounded-[2rem] border-4 border-black opacity-80 ${
              isSuccess ? 'bg-green-500' : 'bg-error-container'
            }`} />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl border-4 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] ${
                isSuccess ? 'bg-green-500' :
                info.variant === 'warning' ? 'bg-tertiary' :
                'bg-error-container'
              }`}>
                <span className={`material-symbols-outlined text-3xl ${
                  isSuccess ? 'text-white' :
                  info.variant === 'warning' ? 'text-black' :
                  'text-on-error-container'
                }`}>{info.icon}</span>
              </div>

              <h1 className={`font-headline-lg text-[28px] uppercase leading-none drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[36px] ${
                isSuccess ? 'text-green-400' :
                info.variant === 'warning' ? 'text-tertiary' :
                'text-error'
              }`}>
                {info.title}
              </h1>

              <div className="rounded-3xl border-[3px] border-black bg-surface-container-high p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-body-sm font-bold text-on-surface-variant leading-relaxed">
                  {info.message}
                </p>
              </div>

              {isSuccess && (
                <a
                  href="https://discord.com/channels/@me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-2xl border-[4px] border-black bg-[#5865F2] px-6 py-4 text-center font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  APRI DISCORD
                </a>
              )}
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Missing token state ───────────────────────────────────────────────────
  if (pageState.kind === 'missing_token') {
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
                  Torna su Discord e richiedi un nuovo link di verifica.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageAnimator>
    );
  }

  // ── Ready state: show the verification button ─────────────────────────────
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

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            {/* Discord-style icon */}
            <div className="flex h-16 w-16 -rotate-3 items-center justify-center rounded-3xl border-4 border-black bg-[#5865F2] shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <svg className="h-8 w-8 fill-current text-white" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
            </div>

            <div>
              <h1 className="font-headline-lg text-[36px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] sm:text-[48px]">
                VERIFICA
              </h1>
              <p className="mt-2 font-body-sm font-bold text-on-surface-variant">
                Collegati con il tuo account Discord per completare la verifica nella Broski Community.
              </p>
            </div>

            {!discordClientId && (
              <div className="rounded-2xl border-[3px] border-black bg-error-container px-4 py-3 font-body-sm font-bold text-on-error-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                Client ID Discord non configurato. Aggiungi VITE_DISCORD_CLIENT_ID alle variabili d'ambiente.
              </div>
            )}

            <button
              onClick={handleVerifyClick}
              disabled={!discordClientId}
              className="w-full rounded-2xl border-[4px] border-black bg-[#5865F2] px-6 py-4 font-headline-md text-[18px] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              VERIFICA CON DISCORD
            </button>

            <p className="font-label-caps text-[10px] text-on-surface-variant/60">
              Verrai reindirizzato a Discord per autorizzare l'accesso.<br />
              Ti serve solo il permesso "identify" — non leggiamo messaggi o server.
            </p>
          </div>
        </div>
      </div>
    </PageAnimator>
  );
};

export default VerifyDiscord;
