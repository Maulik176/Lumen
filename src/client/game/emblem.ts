/**
 * The three medal emblems, drawn in the same single-stroke style as the icons: a round medal on
 * a short ribbon, gold with a lit lantern for Lamplighter, silver with a glow for Glow, bronze
 * with a spark for Spark.
 */
import { UI } from '../../shared/config';
import type { Medal } from '../../shared/types';

const NS = 'http://www.w3.org/2000/svg';

const METAL: Record<Medal, string> = {
  lamplighter: UI.emblemGold,
  glow: UI.emblemSilver,
  spark: UI.emblemBronze,
};

/** What sits on the medal's face, on a 48 x 56 grid with the face centred at (24, 24). */
const FACE: Record<Medal, string> = {
  // A paper lantern with a flame.
  lamplighter:
    'M17.500 17.200q6.500-4.800 13 0l-1.800 14.600h-9.400zM19.500 33.400h9M24 27.600c1.800-1.500 1.900-3.900 0-6.300-1.900 2.400-1.800 4.800 0 6.300z',
  // A small light with a ring of glow.
  glow: 'M24 20.200a3.800 3.800 0 1 0 .01 0zM24 13.200v2.600M24 32.200v2.600M13.200 24h2.600M32.200 24h2.600M16.400 16.400l1.900 1.900M29.700 29.700l1.900 1.900M31.600 16.400l-1.900 1.900M18.300 29.700l-1.900 1.900',
  // A four-pointed spark.
  spark:
    'M24 13.500c.9 5.600 3.900 8.600 9.500 9.500-5.600.9-8.600 3.900-9.500 9.500-.9-5.600-3.900-8.600-9.500-9.500 5.600-.9 8.600-3.900 9.500-9.500z',
};

function path(d: string, attributes: Record<string, string>): SVGPathElement {
  const node = document.createElementNS(NS, 'path');
  node.setAttribute('d', d);
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, value);
  return node;
}

export function medalEmblem(medal: Medal): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 56');
  svg.setAttribute('class', 'emblem');
  svg.setAttribute('aria-hidden', 'true');
  const metal = METAL[medal];
  const line = {
    fill: 'none',
    stroke: UI.ink,
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  svg.append(
    // Two ribbon tails behind the medal.
    path('M15 38l-4.500 15 7-3.200 3.500 5.200 3-13z', {
      ...line,
      fill: metal,
    }),
    path('M33 38l4.500 15-7-3.200-3.500 5.200-3-13z', { ...line, fill: metal }),
    // The medal: a metal rim round a paper face.
    path('M24 4a20 20 0 1 0 .01 0z', { ...line, fill: metal }),
    path('M24 9a15 15 0 1 0 .01 0z', { ...line, fill: UI.paper }),
    path(FACE[medal], line)
  );
  return svg;
}
