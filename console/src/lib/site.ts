// This app is console.restart.ng — the marketing site lives in a separate
// deployment (the `client/` app), so cross-links to it must be plain URLs.
export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || "https://restart.ng";
