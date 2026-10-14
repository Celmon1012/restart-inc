// Shared date, time, number, and currency formatting for the console.
//
// Why this exists: the console previously called `toLocaleDateString()` and
// `toLocaleString()` with no arguments in eleven places. With no locale and no
// options, the output is entirely whatever the viewer's OS locale happens to be
// — so the same invoice could read "24/09/2026" for one operator and
// "9/24/2026" for their colleague, and timestamps varied between 12- and
// 24-hour clocks across a single screen. In an operational console where people
// compare dates and read figures in columns, that inconsistency is a real
// defect rather than a cosmetic one.
//
// Fixing the locale to en-GB and the options explicitly gives every operator the
// same unambiguous rendering. Dates are shown as "24 Sep 2026" rather than
// numeric because a console mixes day-first and month-first audiences, and an
// unambiguous month name removes the question entirely.

const DATE_LOCALE = "en-GB";

/** "24 Sep 2026" — the standard date form across the console. */
const DATE_FMT = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "24 Sep 2026, 14:32" — date with a 24-hour time, for activity rows. */
const DATETIME_FMT = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "14:32" — time alone, for message threads. */
const TIME_FMT = new Intl.DateTimeFormat(DATE_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const EMPTY = "—";

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Stable date, e.g. "24 Sep 2026". Returns an em dash for missing/invalid input. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : EMPTY;
}

/** Stable date and time, e.g. "24 Sep 2026, 14:32". */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATETIME_FMT.format(d).replace(",", ",") : EMPTY;
}

/** Time only, e.g. "14:32". */
export function formatTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? TIME_FMT.format(d) : EMPTY;
}

/** Relative phrasing for recent activity, falling back to an absolute date. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return formatDate(d);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/**
 * Currency amount from minor units (cents). Uses Intl so grouping separators and
 * symbol placement follow the currency rather than the viewer's locale, and
 * falls back to an explicit code when the currency is not recognised — which
 * matters because an unrecognised code must never render as a bare number.
 */
/**
 * A naira amount short enough for a stat tile, whatever its size: ₦100,000, then ₦1.63m, ₦12.5m,
 * ₦1.2bn. Pass kobo. Below a million the figure is shown in full (no kobo); the exact amount belongs
 * in the tile's title so it is one hover away.
 */
export function formatNairaCompact(kobo: number): string {
  const naira = Math.round(kobo) / 100;
  const sign = naira < 0 ? "-" : "";
  const abs = Math.abs(naira);
  if (abs < 1_000_000) return `${sign}₦${Math.round(abs).toLocaleString("en-US")}`;
  const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(abs);
  // "1.63M" -> "1.63m", "1.2B" -> "1.2bn", "3T" -> "3tn"
  return `${sign}₦${short.replace(/M$/, "m").replace(/B$/, "bn").replace(/T$/, "tn")}`;
}

/** A naira amount in whole naira, with no kobo: ₦1,338,923. For table cells, where kobo is noise. */
export function formatNairaWhole(kobo: number): string {
  const naira = Math.round(kobo) / 100;
  return `${naira < 0 ? "-" : ""}₦${Math.round(Math.abs(naira)).toLocaleString("en-US")}`;
}

export function formatAmount(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      // "₦25,000.00", "$12.50", "€9.99": the symbol, not the three-letter code.
      currencyDisplay: "narrowSymbol",
    }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

/** Grouped integer, e.g. "1,240". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * A percentage from 0–100, e.g. "99.99%". Kept separate from formatNumber so a
 * trailing-zero policy lives in one place.
 */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toFixed(digits)}%`;
}
