import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in environment variables!');
}

const isBrowser = typeof window !== 'undefined';

// When served from an ibroski.net domain (www, smp, discord, ...), persist the
// auth session in a cookie scoped to the parent domain so login is shared across
// every subdomain. Elsewhere (localhost, *.vercel.app previews) we fall back to
// localStorage, since a shared parent-domain cookie isn't possible/allowed there.
function crossSubdomainCookieDomain(): string | null {
  if (!isBrowser) return null;
  const host = window.location.hostname;
  if (host === 'ibroski.net' || host.endsWith('.ibroski.net')) return '.ibroski.net';
  return null;
}

const COOKIE_DOMAIN = crossSubdomainCookieDomain();
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
// Max size of a single cookie's VALUE. We store the already URL-encoded string,
// so this is the real byte size — safely under the browser's ~4KB per-cookie cap.
const CHUNK = 3500;

// Writes a raw (already cookie-safe) value. No further encoding is applied here.
function writeCookie(name: string, rawValue: string) {
  let str = `${name}=${rawValue}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  if (COOKIE_DOMAIN) str += `; domain=${COOKIE_DOMAIN}`;
  if (window.location.protocol === 'https:') str += '; Secure';
  document.cookie = str;
}

// Returns the raw stored value (still URL-encoded), or null.
function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return match ? match[1] : null;
}

function deleteCookie(name: string) {
  let str = `${name}=; path=/; max-age=0; SameSite=Lax`;
  if (COOKIE_DOMAIN) str += `; domain=${COOKIE_DOMAIN}`;
  document.cookie = str;
}

function removeCookieKey(key: string) {
  deleteCookie(key);
  let i = 0;
  while (readCookie(`${key}.${i}`) !== null) {
    deleteCookie(`${key}.${i}`);
    i++;
  }
}

// Storage adapter that keeps the Supabase session in cookies (chunked when large)
// so it is shared across ibroski.net subdomains. The value is URL-encoded ONCE and
// then split into cookie-safe chunks (encoding a whole chunk would overflow the
// ~4KB cookie limit and the browser would silently drop it). Reads fall back to a
// previous localStorage session once, migrating existing logins to the cookie.
const crossSubdomainStorage = {
  getItem(key: string): string | null {
    if (!isBrowser) return null;
    const single = readCookie(key);
    if (single !== null) return decodeURIComponent(single);
    if (readCookie(`${key}.0`) !== null) {
      let i = 0;
      let encoded = '';
      let part = readCookie(`${key}.${i}`);
      while (part !== null) {
        encoded += part;
        i++;
        part = readCookie(`${key}.${i}`);
      }
      return decodeURIComponent(encoded);
    }
    // Migration: an existing session previously stored in localStorage.
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    if (!isBrowser) return;
    removeCookieKey(key);
    const encoded = encodeURIComponent(value);
    if (encoded.length <= CHUNK) {
      writeCookie(key, encoded);
    } else {
      let i = 0;
      for (let pos = 0; pos < encoded.length; pos += CHUNK, i++) {
        writeCookie(`${key}.${i}`, encoded.slice(pos, pos + CHUNK));
      }
    }
    // Cookie is now the source of truth; drop any stale localStorage copy.
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  removeItem(key: string) {
    if (!isBrowser) return;
    removeCookieKey(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// Proactively migrate an existing localStorage session into the shared cookie, so
// a user already logged in on www.ibroski.net is recognized on smp.* on their very
// next load (rather than waiting for Supabase to refresh the token first).
if (isBrowser && COOKIE_DOMAIN) {
  let ref: string | null = null;
  try {
    ref = new URL(supabaseUrl || '').hostname.split('.')[0];
  } catch {
    ref = null;
  }
  if (ref) {
    const key = `sb-${ref}-auth-token`;
    const hasCookie = readCookie(key) !== null || readCookie(`${key}.0`) !== null;
    if (!hasCookie) {
      try {
        const ls = window.localStorage.getItem(key);
        if (ls) crossSubdomainStorage.setItem(key, ls);
      } catch {
        /* ignore */
      }
    }
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Only override storage in the browser; SSR/build has no document.cookie.
    ...(isBrowser ? { storage: crossSubdomainStorage } : {}),
  },
});
