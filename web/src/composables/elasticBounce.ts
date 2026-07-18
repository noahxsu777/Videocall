// iPhone-style rubber-band overscroll ("efecto rebote").
//
// When a scroll container is dragged past its top or bottom edge, its
// content follows the finger with increasing resistance and then springs
// back on release — the elastic bounce native iOS apps have. We recreate
// it for every real scroll container (works on Android too, where the
// browser has no native bounce, and on iOS where our `overscroll-behavior:
// contain` had suppressed it).
//
// Applied globally via touch listeners so individual views don't need to
// opt in. Skipped on the full-screen live / call / reels routes (reels has
// its own scroll-snap paging and live views can't be nudged).

const MAX = 150; // furthest the content can rubber-band (px)
const DAMP = 0.42; // finger-to-travel ratio before the soft cap

let scroller: HTMLElement | null = null;
let startY = 0;
let offset = 0;
let bouncing = false;
let edge: 'top' | 'bottom' | null = null;

function routeAllowsBounce(): boolean {
  const h = location.hash || '';
  return !(
    h.startsWith('#/reels')
    || h.startsWith('#/live-pusher')
    || h.startsWith('#/live-player')
    || h.startsWith('#/business/live-player')
    || h.startsWith('#/education/live-player')
    || h.startsWith('#/call')
  );
}

function findScroller(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    if (node.dataset && node.dataset.noBounce !== undefined) {
      return null;
    }
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Diminishing resistance: the further you pull, the harder it gets, easing
// toward MAX so it never runs away — matches the iOS feel.
function damp(dy: number): number {
  const raw = Math.abs(dy) * DAMP;
  const eased = MAX * (1 - Math.exp(-raw / MAX));
  return Math.sign(dy) * eased;
}

function apply(px: number) {
  if (!scroller) {
    return;
  }
  scroller.style.transition = 'none';
  scroller.style.transform = px === 0 ? '' : `translate3d(0, ${px}px, 0)`;
  scroller.style.willChange = px === 0 ? '' : 'transform';
}

function springBack() {
  const el = scroller;
  if (!el) {
    return;
  }
  el.style.transition = 'transform 0.42s cubic-bezier(0.18, 0.9, 0.28, 1.08)';
  el.style.transform = '';
  const clear = () => {
    el.style.transition = '';
    el.style.willChange = '';
    el.removeEventListener('transitionend', clear);
  };
  el.addEventListener('transitionend', clear);
  // Safety: clear even if transitionend never fires (e.g. offset was 0).
  window.setTimeout(clear, 480);
}

function onTouchStart(e: TouchEvent) {
  bouncing = false;
  edge = null;
  offset = 0;
  scroller = null;
  if (e.touches.length !== 1 || !routeAllowsBounce()) {
    return;
  }
  scroller = findScroller(e.target as HTMLElement);
  startY = e.touches[0].clientY;
}

function onTouchMove(e: TouchEvent) {
  if (!scroller) {
    return;
  }
  const dy = e.touches[0].clientY - startY;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

  // Decide (once) which edge we're rubber-banding, if any.
  if (!bouncing) {
    if (atTop && dy > 0) {
      edge = 'top';
    } else if (atBottom && dy < 0) {
      edge = 'bottom';
    } else {
      return; // normal scroll — leave the browser alone
    }
    bouncing = true;
  }

  // If the user reverses back inside the content, hand control back to the
  // native scroll instead of holding the transform.
  if ((edge === 'top' && dy <= 0) || (edge === 'bottom' && dy >= 0)) {
    bouncing = false;
    offset = 0;
    springBack();
    return;
  }

  if (e.cancelable) {
    e.preventDefault(); // stop the native scroll/glow from fighting the bounce
  }
  offset = damp(dy);
  apply(offset);
}

function onTouchEnd() {
  if (bouncing) {
    springBack();
  }
  bouncing = false;
  edge = null;
  offset = 0;
  scroller = null;
}

/** Install the global rubber-band bounce. Call once at app start. */
export function installElasticBounce(): void {
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  // Non-passive so we can preventDefault the native scroll only while an
  // actual overscroll bounce is in progress (normal scrolls stay passive).
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}
