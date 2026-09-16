// The client console is a separate deployment (the `console/` app) at
// console.restart.ng, so links to it from the marketing site are plain URLs.
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL || "https://console.restart.ng";
