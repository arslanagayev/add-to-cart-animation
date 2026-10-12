import { isAutoplay, mountReel } from './reel/reel.js';

const root = document.querySelector('.shop');
const card = root.querySelector('.card');
const photo = card.querySelector('.photo img');
const sizeRow = card.querySelector('.size-row');
const add = card.querySelector('.add');
const doneText = add.querySelector('.done-text');
const bag = root.querySelector('.bag');
const badge = bag.querySelector('.badge');
const badgeNum = bag.querySelector('.badge-num');
const status = root.querySelector('[role="status"]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The reel and its recordings always use the light theme.
if (isAutoplay) document.documentElement.dataset.reel = '';

const FLIGHT = 900;
let count = 0;
let flying = false;
let doneTimer = 0;

const selectedSize = () => card.querySelector('input[name="size"]:checked')?.value;

/** A short sideways shake, the usual "not yet" signal. */
function shake(el) {
  el.animate(
    { translate: ['0 0', '-10px 0', '9px 0', '-6px 0', '3px 0', '0 0'] },
    { duration: 420, easing: 'ease-out' },
  );
}

/**
 * Flies a round crop of the product photo from the card to the bag. Two nested elements make the
 * arc: the outer one moves sideways at a steady pace while the inner one rises and then drops,
 * so together they trace a curve without any path maths.
 */
async function flyToBag() {
  const from = photo.getBoundingClientRect();
  const to = bag.getBoundingClientRect();
  const scale = from.width / photo.offsetWidth; // the reel stage is scaled down to fit the window
  const size = 96 * scale;
  const x0 = from.left + from.width / 2 - size / 2;
  const y0 = from.top + from.height / 2 - size / 2;
  const x1 = to.left + to.width / 2 - size / 2;
  const y1 = to.top + to.height / 2 - size / 2;
  // Rise a little above the higher end of the flight, but never past the top of the window.
  const peak = Math.max(Math.min(y0, y1) - 110 * scale, 6 * scale);

  const outer = document.createElement('div');
  const inner = document.createElement('div');
  outer.className = 'flyer-x';
  inner.className = 'flyer';
  inner.style.width = inner.style.height = `${size}px`;
  inner.style.borderWidth = `${3 * scale}px`;
  inner.style.backgroundImage = `url("${photo.currentSrc || photo.src}")`;
  outer.append(inner);
  document.body.append(outer);

  bag.classList.add('is-open');
  const across = outer.animate(
    { translate: [`${x0}px 0`, `${x1}px 0`] },
    { duration: FLIGHT, easing: 'cubic-bezier(0.3, 0, 0.6, 1)', fill: 'forwards' },
  );
  inner.animate(
    [
      { translate: `0 ${y0}px`, scale: 0.5, rotate: '0deg', opacity: 0, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' },
      { translate: `0 ${y0 - 20 * scale}px`, scale: 1.1, rotate: '-6deg', opacity: 1, offset: 0.18, easing: 'cubic-bezier(0.25, 0.8, 0.4, 1)' },
      { translate: `0 ${peak}px`, scale: 0.85, rotate: '-14deg', offset: 0.5, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
      { translate: `0 ${y1}px`, scale: 0.3, rotate: '18deg', opacity: 1 },
    ],
    { duration: FLIGHT, fill: 'forwards' },
  );
  await across.finished;
  outer.remove();
}

/** The bag catches the product: it closes, wobbles, and the counter rolls to the new number. */
async function catchInBag() {
  bag.classList.remove('is-open');
  bag.animate(
    { rotate: ['0deg', '-14deg', '10deg', '-6deg', '3deg', '0deg'], translate: ['0 0', '0 4px', '0 -3px', '0 0'] },
    { duration: 620, easing: 'ease-out' },
  );

  const first = !bag.classList.contains('has-items');
  bag.classList.add('has-items');
  badge.animate({ scale: first ? [0, 1.45, 0.9, 1] : [1, 1.45, 0.9, 1] }, { duration: 460, easing: 'ease-out' });
  if (!first && !reduceMotion.matches) {
    await badgeNum.animate({ translate: ['0 0', '0 -120%'], opacity: [1, 0] }, { duration: 140, easing: 'ease-in' }).finished;
  }
  badgeNum.textContent = String(count);
  if (!first && !reduceMotion.matches) {
    badgeNum.animate({ translate: ['0 120%', '0 0'], opacity: [0, 1] }, { duration: 220, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  }
}

async function addToBag() {
  if (flying) return;
  const size = selectedSize();
  if (!size) {
    card.classList.add('needs-size');
    shake(sizeRow);
    status.textContent = 'Pick your size first';
    return;
  }

  flying = true;
  count++;
  clearTimeout(doneTimer);
  doneText.textContent = `Added, EU ${size}`;
  add.classList.add('is-done');
  bag.setAttribute('aria-label', `Bag, ${count} ${count === 1 ? 'item' : 'items'}`);
  status.textContent = `Loop Runner, size ${size}, added to your bag. ${count} ${count === 1 ? 'item' : 'items'} in your bag.`;

  if (!reduceMotion.matches) await flyToBag();
  await catchInBag();
  flying = false;
  doneTimer = setTimeout(() => add.classList.remove('is-done'), 1400);
}

add.addEventListener('click', () => { void addToBag(); });
sizeRow.addEventListener('change', () => card.classList.remove('needs-size'));

function reset() {
  for (const el of [bag, badge, badgeNum, sizeRow]) el.getAnimations().forEach((a) => a.cancel());
  document.querySelectorAll('.flyer-x').forEach((el) => el.remove());
  clearTimeout(doneTimer);
  count = 0;
  flying = false;
  badgeNum.textContent = '0';
  bag.classList.remove('has-items', 'is-open');
  bag.setAttribute('aria-label', 'Bag, 0 items');
  add.classList.remove('is-done');
  card.classList.remove('needs-size');
  card.querySelectorAll('input[name="size"]').forEach((input) => { input.checked = false; });
  status.textContent = '';
}

/* ---------- Reel mode ---------- */

const sizeLabel = (value) => card.querySelector(`input[value="${value}"]`).closest('label');

mountReel({
  eyebrow: 'UI animation #08',
  title: 'Add to',
  accent: 'bag.',
  demo: root,
  demoScale: 1.9,
  file: 'add-to-cart-animation/script.js',
  code: `
// Two nested boxes draw the arc: the outer
// one slides sideways, the inner one rises
// and then drops into the bag.
outer.animate(
  { translate: [\`\${x0}px 0\`, \`\${x1}px 0\`] },
  { duration: 900 },
);
inner.animate([
  { translate: \`0 \${y0}px\`, scale: 0.5 },
  { translate: \`0 \${peak}px\`, offset: 0.5 },
  { translate: \`0 \${y1}px\`, scale: 0.3 },
], { duration: 900 });`,
  reset,
  async play({ cursor, sleep }) {
    await sleep(700);
    await cursor.click(add);          // no size yet: the sizes shake
    await sleep(1100);
    await cursor.click(sizeLabel('42'));
    await sleep(500);
    await cursor.click(add);
    cursor.park();
    await sleep(2400);
    await cursor.click(sizeLabel('40'));
    await sleep(400);
    await cursor.click(add);
    cursor.park();
    await sleep(2600);
  },
});
