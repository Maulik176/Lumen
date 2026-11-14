/**
 * The feed card. Paints from the post's own data, with no request and no Three.js.
 * Milestone 7 turns this into the full preview (silhouette, sky strip, streak, return visit).
 */
import { context, requestExpandedMode } from '@devvit/web/client';
import { readPostData } from '../shared/api';
import { weekdayLabel } from '../shared/calendar';
import { COPY } from '../shared/config';

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`missing #${id}`);
  return node;
}

const post = readPostData(context.postData);
const play = byId('play');
play.textContent = COPY.playButton;
byId('goal').textContent = COPY.previewGoal;
const how = byId('how');
how.textContent = COPY.howToPlay;

if (post !== null) {
  byId('kicker').textContent =
    `Lumen #${post.day} · ${weekdayLabel(post.weekday)}`;
  byId('name').textContent = post.name;
  byId('line').textContent =
    post.lanterns === 1
      ? COPY.previewLineOne
      : COPY.previewLine.replace('{lanterns}', String(post.lanterns));
  byId('par').textContent = `par ${post.par}`;
} else {
  byId('name').textContent = 'Lumen';
}

// Expanded mode must be asked for directly inside the tap, never after waiting for anything.
how.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'howto');
  } catch (error) {
    console.error(error);
  }
});
play.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'game');
  } catch (error) {
    console.error(error);
  }
});
