// server.cjs — Mini Express server per produzione su VPS / Coolify.
// Sostituisce le Vercel serverless functions (api/discord-callback.ts).
// Serve i file statici di Vite (dist/) + l'API /api/discord-callback +
// fallback SPA: tutte le route non-API rimandano a index.html.
//
// Avviare con:  node server.cjs   (la porta di default è 3000)

const express = require('express');
const path = require('path');
const app = express();

// ── Variabili d'ambiente (impostate in Coolify) ────────────────────────────
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;
const BROSKI_WEBHOOK_SECRET = process.env.BROSKI_WEBHOOK_SECRET;
const BROSKI_BOT_WEBHOOK_URL = process.env.BROSKI_BOT_WEBHOOK_URL;

const DISCORD_API = 'https://discord.com/api/v10';

// ── Helper: retry con backoff esponenziale ─────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      // 4xx = non ritentare
      if (resp.status >= 400 && resp.status < 500) return resp;
      // 2xx / 3xx = successo
      if (resp.ok || (resp.status >= 300 && resp.status < 400)) return resp;
      // 5xx = ritenta se ci sono tentativi rimasti
      lastError = new Error('Server responded with ' + resp.status);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries - 1) {
      await new Promise(function (r) { return setTimeout(r, Math.pow(2, attempt) * 1000); });
    }
  }
  throw lastError;
}

// ── Helper: redirect con result code ──────────────────────────────────────
function redirectToResult(res, host, result) {
  var proto = host.startsWith('localhost') ? 'http' : 'https';
  return res.redirect(302, proto + '://' + host + '/?result=' + encodeURIComponent(result));
}

// ── API: Discord OAuth2 callback (/api/discord-callback) ───────────────────
app.get('/api/discord-callback', async function (req, res) {
  var code = req.query.code;
  var host = req.get('host') || 'verify.ibroski.net';

  // Legge il verify_token dal cookie impostato dal frontend
  var cookieHeader = req.get('cookie') || '';
  var cookieMatch = cookieHeader.match(/(?:^|;\s*)verify_token=([^;]*)/);
  var verifyToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

  if (!code) {
    return redirectToResult(res, host, 'discord_denied:authorization_denied');
  }
  if (!verifyToken) {
    return redirectToResult(res, host, 'missing_token');
  }
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    console.error('[discord-callback] Variabili OAuth Discord mancanti');
    return redirectToResult(res, host, 'config_error');
  }

  // 1. Scambia il code per un access token
  var tokenResp;
  try {
    tokenResp = await fetch(DISCORD_API + '/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
  } catch (err) {
    console.error('[discord-callback] Discord non raggiungibile (token exchange):', err.message);
    return redirectToResult(res, host, 'discord_unreachable');
  }

  if (!tokenResp.ok) {
    console.error('[discord-callback] Token exchange fallito:', tokenResp.status);
    return redirectToResult(res, host, 'discord_auth_failed');
  }

  var tokenData = await tokenResp.json();

  // 2. Recupera l'utente Discord
  var userResp;
  try {
    userResp = await fetch(DISCORD_API + '/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
  } catch (err) {
    console.error('[discord-callback] Discord non raggiungibile (user fetch):', err.message);
    return redirectToResult(res, host, 'discord_unreachable');
  }

  if (!userResp.ok) {
    console.error('[discord-callback] User fetch fallito:', userResp.status);
    return redirectToResult(res, host, 'discord_auth_failed');
  }

  var userData = await userResp.json();
  var discordId = userData.id; // stringa (18-19 cifre) — NON number

  // 3. Webhook verso BroskiBOT
  if (!BROSKI_BOT_WEBHOOK_URL || !BROSKI_WEBHOOK_SECRET) {
    console.error('[discord-callback] Variabili webhook BroskiBOT mancanti');
    return redirectToResult(res, host, 'config_error');
  }

  try {
    var webhookResp = await fetchWithRetry(BROSKI_BOT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + BROSKI_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        discord_id: discordId,
        token: verifyToken,
      }),
    });

    if (webhookResp.ok) {
      // Successo — cancella il cookie e redirect
      var successProto = host.startsWith('localhost') ? 'http' : 'https';
      return res
        .status(302)
        .set({
          Location: successProto + '://' + host + '/?result=success',
          'Set-Cookie': 'verify_token=; path=/; max-age=0; HttpOnly; SameSite=Lax; Secure',
        })
        .end();
    }

    if (webhookResp.status === 400) {
      return redirectToResult(res, host, 'token_invalid');
    }

    if (webhookResp.status === 401) {
      console.error('[discord-callback] Autenticazione webhook fallita — controlla BROSKI_WEBHOOK_SECRET');
      return redirectToResult(res, host, 'config_error');
    }

    console.error('[discord-callback] Webhook risposta inattesa:', webhookResp.status);
    return redirectToResult(res, host, 'bot_error');
  } catch (err) {
    console.error('[discord-callback] Webhook non raggiungibile:', err.message);
    return redirectToResult(res, host, 'bot_unreachable');
  }
});

// ── File statici (build Vite) ─────────────────────────────────────────────
var distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ── File statici da public/ (robots.txt, sitemap.xml, .well-known/, etc.) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── SPA fallback: ogni rotta non-API e non-file → index.html ──────────────
// Questo equivale al "rewrites" di vercel.json.
app.get('*', function (_req, res) {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Avvio ─────────────────────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('[server] BroskiWebSite in ascolto sulla porta ' + PORT);
});
