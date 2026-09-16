// Supabase's default storage is localStorage, which is scoped per-origin —
// restart.ng and console.restart.ng can't see each other's session that way.
// This backs the Supabase client with a cookie scoped to the shared root
// domain instead, so both apps can read the same session.
//
// A Google OAuth session (access + refresh token, full user metadata,
// identities array with duplicated provider data) commonly exceeds a
// single cookie's ~4KB limit. Browsers drop an oversized cookie silently —
// no error, `document.cookie` just never gets it — so large values are
// split across numbered chunks (key.0, key.1, ...) and reassembled on
// read, the same convention Supabase's own storage helpers use.
const COOKIE_DOMAIN = import.meta.env.VITE_AUTH_COOKIE_DOMAIN || "";
const CHUNK_SIZE = 3180;
const MAX_CHUNKS = 20;

function domainAttr() {
  return COOKIE_DOMAIN ? `; domain=${COOKIE_DOMAIN}` : "";
}

function secureAttr() {
  return typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
}

function readRawCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeRawCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax${secureAttr()}${domainAttr()}`;
}

function deleteRawCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0${domainAttr()}`;
}

function getCookie(name: string): string | null {
  const direct = readRawCookie(name);
  if (direct !== null) return direct;

  // No unchunked value — look for key.0, key.1, ... and reassemble.
  const parts: string[] = [];
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = readRawCookie(`${name}.${i}`);
    if (part === null) break;
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("") : null;
}

function clearChunks(name: string) {
  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (readRawCookie(`${name}.${i}`) === null) break;
    deleteRawCookie(`${name}.${i}`);
  }
}

function setCookie(name: string, value: string) {
  // A previous write may have left chunks behind (e.g. a session that
  // shrank back under the single-cookie limit) — always clear them before
  // writing the new shape so stale chunks never linger and get preferred
  // over a fresh unchunked value.
  clearChunks(name);

  if (value.length <= CHUNK_SIZE) {
    writeRawCookie(name, value);
    return;
  }

  deleteRawCookie(name);
  for (let i = 0; i * CHUNK_SIZE < value.length; i++) {
    writeRawCookie(`${name}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

function removeCookie(name: string) {
  deleteRawCookie(name);
  clearChunks(name);
}

export const cookieStorage = {
  getItem: (key: string) => getCookie(key),
  setItem: (key: string, value: string) => setCookie(key, value),
  removeItem: (key: string) => removeCookie(key),
};
