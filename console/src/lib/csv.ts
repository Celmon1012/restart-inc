// Download a table as a CSV file (opens cleanly in Excel and Sheets).

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  // The byte-order mark makes Excel read the file as UTF-8, so ₦ and accents survive.
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
