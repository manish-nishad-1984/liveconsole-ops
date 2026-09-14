/** Minimal CSV writer — every spreadsheet opens it, and it needs no dependency. */

const cell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A leading BOM so Excel reads the file as UTF-8 (₹, Gujarati and Hindi names). */
export const toCsv = (header: string[], rows: unknown[][]): string =>
  `﻿${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}`;

export const csvFileName = (base: string): string =>
  `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
