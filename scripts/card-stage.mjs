/**
 * Shared by the card picture scripts (`hero.mjs`, `day-cards.mjs`): an empty stage before the
 * picture, and a check of the framing after it.
 *
 * Nov 27: the stock pictures rendered on Nov 26 had the island pushed left and cut, because a
 * one-time rule card was open (the stand-in remembers rules seen per player on the server since
 * Nov 20, so the old localStorage trick no longer closed it) and a card on a wide view moves the
 * island aside. Now every rule is marked seen on the server for the page's player, the page is
 * loaded again, any card still open is closed, and the island's measured position must be
 * centred, or the script stops.
 */
const RULES = ['fixed', 'water', 'colour', 'mixed', 'sky'];

/** Mark every rule seen for this page's player, on the server and on the device; reload. */
export async function clearStage(page) {
  await page.run(
    `Promise.all(${JSON.stringify(RULES)}.map((rule) =>
       fetch('/api/rule-seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rule }) })))
     .then(() => {
       for (const rule of ${JSON.stringify(RULES)}) localStorage.setItem('lumen.rule.' + rule, '1');
       localStorage.setItem('lumen.hints.done', '1');
       localStorage.setItem('lumen.tutorial.done', '1');
       location.reload();
     }); 1`
  );
  await page.sleep(4500);
  // Anything still open (a warm-up offer, a card) is closed, and the island given time to
  // glide back to its place.
  for (let i = 0; i < 6; i++) {
    const open = await page.run(
      `(() => { const b = [...document.querySelectorAll('button')].find((n) => /^(Got it|Not now|Play tonight's island)$/.test(n.textContent.trim()) && n.offsetParent !== null); if (b) b.click(); return Boolean(b); })()`
    );
    if (!open) break;
    await page.sleep(900);
  }
  await page.sleep(1200);
  const sheeting = await page.run(
    `document.querySelector('.hud.sheeting, .hud .offer:not([hidden])') !== null`
  );
  if (sheeting) throw new Error('a card is still open: the island would be framed for it');
}

/**
 * Where the island sits in the picture, from the game's own tile positions (needs `perf=1`):
 * its centre must be within `slack` of the middle, across and down, and it must be whole.
 */
export async function checkFraming(page, size, { slack = 0.06 } = {}) {
  const box = await page.run(`(() => {
    const n = window.lumenSize;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of [[0, 0], [n.w - 1, 0], [0, n.h - 1], [n.w - 1, n.h - 1]]) {
      const p = window.lumenScreen(x, y);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, x1, y0, y1 };
  })()`);
  const across = (box.x0 + box.x1) / 2 / size.width;
  const down = (box.y0 + box.y1) / 2 / size.height;
  const whole =
    box.x0 > 0 && box.x1 < size.width && box.y0 > 0 && box.y1 < size.height;
  if (Math.abs(across - 0.5) > slack || Math.abs(down - 0.5) > slack * 2 || !whole)
    throw new Error(
      `island off centre: centre at ${(across * 100).toFixed(0)}% across, ${(down * 100).toFixed(0)}% down, corners ${JSON.stringify(box)}`
    );
  return { across, down };
}
