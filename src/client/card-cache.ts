/**
 * What this device remembers about a solved day, so the feed card can show "Lit" at once on a
 * return visit, before the server has answered. The server's answer always replaces it.
 * Kept in localStorage; if storage is unavailable the card simply waits for the server.
 */
import type { CardResult } from '../shared/api';

const key = (day: number): string => `lumen.card.${day}`;

export function rememberSolved(day: number, result: CardResult): void {
  try {
    localStorage.setItem(key(day), JSON.stringify(result));
  } catch {
    // Nothing is remembered; the card asks the server.
  }
}

export function recallSolved(day: number): CardResult | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(day)) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const fields: Record<string, unknown> = { ...value };
    const { pieces, par, rank, streak } = fields;
    if (
      typeof pieces !== 'number' ||
      typeof par !== 'number' ||
      typeof rank !== 'number' ||
      typeof streak !== 'number'
    )
      return null;
    return { pieces, par, rank, streak };
  } catch {
    return null;
  }
}
