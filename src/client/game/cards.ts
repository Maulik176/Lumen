/**
 * Small paper cards shown in the result card's place before play: the one-time rule cards (a
 * tiny drawing and one line), and the offer of an easier island to a newcomer on a hard day.
 */
import { COPY, LOOK } from '../../shared/config';
import type { RuleKind } from '../../shared/rules';
import { element } from './hud';
import { css } from './kit';

const RULE_COPY: Record<RuleKind, string> = {
  fixed: COPY.ruleFixed,
  water: COPY.ruleWater,
  colour: COPY.ruleColour,
  mixed: COPY.ruleMixed,
};

const NS = 'http://www.w3.org/2000/svg';

function shape(
  tag: 'circle' | 'path' | 'rect',
  attributes: Record<string, string>
): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, value);
  return node;
}

/** A tiny drawing for each rule, in the game's own colours, on a 64 x 36 grid. */
function drawing(kind: RuleKind): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 36');
  svg.setAttribute('class', 'rule-art');
  svg.setAttribute('aria-hidden', 'true');
  const ink = 'currentColor';
  const beam = (d: string, hex: number): SVGElement =>
    shape('path', {
      d,
      fill: 'none',
      stroke: css(hex),
      'stroke-width': '3.2',
      'stroke-linecap': 'round',
    });
  const lantern = (x: number, hex: number): SVGElement =>
    shape('circle', {
      cx: String(x),
      cy: '18',
      r: '7',
      fill: css(hex),
      stroke: ink,
      'stroke-width': '1.6',
    });
  if (kind === 'colour') {
    svg.append(beam('M4 18H40', LOOK.beamRed), lantern(50, LOOK.beamRed));
  } else if (kind === 'mixed') {
    svg.append(
      beam('M4 8L42 16', LOOK.beamRed),
      beam('M4 28L42 20', LOOK.beamBlue),
      lantern(50, LOOK.lanternMagenta)
    );
  } else if (kind === 'water') {
    svg.append(
      shape('rect', {
        x: '22',
        y: '6',
        width: '20',
        height: '24',
        rx: '4',
        fill: '#5aa6cc',
        opacity: '0.75',
      }),
      beam('M4 18H60', LOOK.lanternWarm)
    );
  } else {
    svg.append(
      beam('M4 26H32V4', LOOK.lanternWarm),
      shape('path', {
        d: 'M22 34L42 16',
        fill: 'none',
        stroke: css(LOOK.stoneDark),
        'stroke-width': '5',
        'stroke-linecap': 'round',
      })
    );
  }
  return svg;
}

/** One rule: its drawing, its line, and "Got it". */
export function ruleCard(kind: RuleKind, onDone: () => void): HTMLElement {
  const holder = element('div', 'sheet-body rule-card');
  const done = element('button', 'button button-quiet', COPY.gotIt);
  done.type = 'button';
  done.addEventListener('click', onDone);
  holder.append(
    drawing(kind),
    element('p', 'rule-line', RULE_COPY[kind]),
    done
  );
  return holder;
}

/** "Warm up on an easier island first?" Both answers carry the same weight. */
export function askWarmUp(root: HTMLElement): Promise<'warm' | 'today'> {
  return new Promise((resolve) => {
    const panel = element('section', 'panel offer');
    const answer = (choice: 'warm' | 'today', text: string): HTMLElement => {
      const button = element('button', 'button button-quiet', text);
      button.type = 'button';
      button.addEventListener('click', () => {
        panel.remove();
        resolve(choice);
      });
      return button;
    };
    const buttons = element('div', 'prompt-buttons');
    buttons.append(
      answer('warm', COPY.warmUpYes),
      answer('today', COPY.warmUpNo)
    );
    panel.append(
      element('h2', 'sheet-title', COPY.warmUpAsk),
      element('p', 'rule-line', COPY.warmUpWhy),
      buttons
    );
    root.append(panel);
  });
}
