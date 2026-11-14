/**
 * "See how everyone solved it": the island's tiles warm by where players put their pieces, and a
 * small sheet says how many hit par. For an earlier night, the par answer can be laid on the
 * island and taken off again.
 */
import type { HeatResponse } from '../../shared/api';
import { COPY, HEAT } from '../../shared/config';
import { element } from './hud';

export type Heat = Extract<HeatResponse, { ok: true }>;

export async function loadHeat(day: number): Promise<Heat | null> {
  try {
    const response = await fetch(`/api/heatmap?day=${day}`);
    const body: HeatResponse = await response.json();
    return body.ok ? body : null;
  } catch {
    return null;
  }
}

/** The one line: how many hit par, or something gentler while there are only a few. */
export function crowdLine(heat: Heat, tonight: boolean): string {
  if (heat.solves < HEAT.fewSolves)
    return tonight ? COPY.crowdFew : COPY.crowdFewPast;
  const percent = Math.round((heat.parHits / heat.solves) * 100);
  return (tonight ? COPY.crowdPar : COPY.crowdParPast).replace(
    '{percent}',
    String(percent)
  );
}

export function crowdSheet(
  heat: Heat | null,
  tonight: boolean,
  /** Lay the par answer (true) or the player's own pieces (false) on the island. */
  showPar: ((par: boolean) => void) | null,
  onClose: () => void
): HTMLElement {
  const holder = element('div', 'sheet-body');
  holder.style.display = 'contents';
  holder.append(
    element(
      'h2',
      'sheet-title',
      heat === null ? COPY.crowdLocked : crowdLine(heat, tonight)
    )
  );
  if (heat !== null)
    holder.append(element('p', 'sheet-empty crowd-hint', COPY.crowdHint));
  if (heat?.parSolution != null && showPar !== null) {
    let par = false;
    const toggle = element('button', 'button button-quiet', COPY.showPar);
    toggle.type = 'button';
    toggle.addEventListener('click', () => {
      par = !par;
      toggle.textContent = par ? COPY.showMine : COPY.showPar;
      showPar(par);
    });
    holder.append(toggle);
  }
  const close = element('button', 'button button-quiet sheet-close', COPY.back);
  close.type = 'button';
  close.addEventListener('click', onClose);
  holder.append(close);
  return holder;
}
