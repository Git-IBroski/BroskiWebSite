/**
 * Vercel serverless function — Discord OAuth2 callback handler.
 *
 * Flow:
 *  1. Receives `?code=XXX&state=YYY` from Discord after user authorizes
 *  2. Exchanges the code for an access token (POST to Discord API)
 *  3. Fetches the authenticated user's `id` from Discord (`/users/@me`)
 *  4. Reads the original verification token from the `verify_token` cookie
 *  5. POSTs `{ discord_id, token }` to the BroskiBOT webhook
 *  6. Redirects the browser back to the frontend with a result query param
 *
 * Required Vercel environment variables (set in Vercel dashboard, NOT in .env):
 *  - DISCORD_CLIENT_ID
 *  - DISCORD_CLIENT_SECRET
 *  - DISCORD_REDIRECT_URI      (must match exactly what is registered in Discord Developer Portal)
 *  - BROSKI_WEBHOOK_SECRET     (shared secret with the bot — used as Bearer token)
 *  - BROSKI_BOT_WEBHOOK_URL    (full URL of the bot webhook, e.g. http://<ip>:<port>/webhook/verify)
 */

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

/**
 * Retry a fetch request on network errors or 5xx responses with
 * exponential backoff (1s → 2s → 4s). Does NOT retry on 4xx errors.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Client errors (4xx) — no retry
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Success (2xx) or redirect (3xx) — done
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return response;
      }

      // Server error (5xx) — retry if we have attempts left
      lastError = new Error(`Server responded with ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError;
}

function buildRedirectUrl(host: string, result: string): string {
  // In production, the frontend is served from the same origin
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}/?result=${encodeURIComponent(result)}`;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const host = req.headers.get('host') || 'verify.ibroski.net';

  // Read the verification token from the cookie set by the frontend
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)verify_token=([^;]*)/);
  const verifyToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

  // If no code from Discord, something went wrong with the OAuth flow
  if (!code) {
    const errorDesc = url.searchParams.get('error_description') || 'authorization_denied';
    return Response.redirect(buildRedirectUrl(host, `discord_denied:${encodeURIComponent(errorDesc)}`), 302);
  }

  if (!verifyToken) {
    return Response.redirect(buildRedirectUrl(host, 'missing_token'), 302);
  }

  // ── 1. Exchange authorization code for access token ──────────────────────
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Missing Discord OAuth environment variables');
    return Response.redirect(buildRedirectUrl(host, 'config_error'), 302);
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    return Response.redirect(buildRedirectUrl(host, 'discord_unreachable'), 302);
  }

  if (!tokenResponse.ok) {
    console.error(`Discord token exchange failed with status ${tokenResponse.status}`);
    return Response.redirect(buildRedirectUrl(host, 'discord_auth_failed'), 302);
  }

  const tokenData: DiscordTokenResponse = await tokenResponse.json();

  // ── 2. Get the authenticated user's Discord ID ───────────────────────────
  let userResponse: Response;
  try {
    userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch {
    return Response.redirect(buildRedirectUrl(host, 'discord_unreachable'), 302);
  }

  if (!userResponse.ok) {
    console.error(`Discord user fetch failed with status ${userResponse.status}`);
    return Response.redirect(buildRedirectUrl(host, 'discord_auth_failed'), 302);
  }

  const userData: DiscordUser = await userResponse.json();
  const discordId = userData.id; // Must be sent as a string (18-19 digits)

  // ── 3. Send webhook to BroskiBOT ─────────────────────────────────────────
  const webhookUrl = process.env.BROSKI_BOT_WEBHOOK_URL;
  const webhookSecret = process.env.BROSKI_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    console.error('Missing BroskiBOT webhook environment variables');
    return Response.redirect(buildRedirectUrl(host, 'config_error'), 302);
  }

  try {
    const webhookResponse = await fetchWithRetry(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({
        discord_id: discordId,
        token: verifyToken,
      }),
    });

    if (webhookResponse.ok) {
      // Success — clear the verify_token cookie and redirect to success page
      return new Response(null, {
        status: 302,
        headers: {
          Location: buildRedirectUrl(host, 'success'),
          'Set-Cookie': 'verify_token=; path=/; max-age=0; HttpOnly; SameSite=Lax; Secure',
        },
      });
    }

    if (webhookResponse.status === 400) {
      // Token invalid, expired, or already used
      return Response.redirect(buildRedirectUrl(host, 'token_invalid'), 302);
    }

    if (webhookResponse.status === 401) {
      console.error('Webhook authentication failed — check BROSKI_WEBHOOK_SECRET');
      return Response.redirect(buildRedirectUrl(host, 'config_error'), 302);
    }

    // Other unexpected status codes
    console.error('Webhook unexpected response:', webhookResponse.status);
    return Response.redirect(buildRedirectUrl(host, 'bot_error'), 302);
  } catch {
    // All retries exhausted or network error
    return Response.redirect(buildRedirectUrl(host, 'bot_unreachable'), 302);
  }
}
