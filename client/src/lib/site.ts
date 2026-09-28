// The client console is a separate deployment (the `console/` app) at
// console.restart.ng, so links to it from the marketing site are plain URLs.
export const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL || "https://console.restart.ng";

// Restart's WhatsApp number, digits only (country code first). Used for
// tap-to-chat links only: the visitor opens the chat and sends the first
// message themselves, and a person replies from the WhatsApp Business app.
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "2349060114747";

export function whatsappLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Normalises a phone number to E.164 ("+2348064118424"), or returns null if
 * it can't be read as one. A local Nigerian number ("0806 411 8424") is
 * assumed to be +234, since that's most of who fills these forms in.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  let e164: string;
  if (digits.startsWith("+")) e164 = "+" + digits.slice(1).replace(/\+/g, "");
  else if (digits.startsWith("00")) e164 = "+" + digits.slice(2);
  else if (/^0\d{10}$/.test(digits)) e164 = "+234" + digits.slice(1);
  else if (digits.startsWith("234")) e164 = "+" + digits;
  else return null;
  return /^\+\d{8,15}$/.test(e164) ? e164 : null;
}
