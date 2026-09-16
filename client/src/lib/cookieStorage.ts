// Supabase's default storage is localStorage, which is scoped per-origin —
// restart.ng and console.restart.ng can't see each other's session that way.
// This backs the Supabase client with a cookie scoped to the shared root
// domain instead, so both apps can read the same session.
const COOKIE_DOMAIN = import.meta.env.VITE_AUTH_COOKIE_DOMAIN || "";

function domainAttr() {
  return COOKIE_DOMAIN ? `; domain=${COOKIE_DOMAIN}` : "";
}

function secureAttr() {
  return typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax${secureAttr()}${domainAttr()}`;
}

function removeCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0${domainAttr()}`;
}

export const cookieStorage = {
  getItem: (key: string) => getCookie(key),
  setItem: (key: string, value: string) => setCookie(key, value),
  removeItem: (key: string) => removeCookie(key),
};
