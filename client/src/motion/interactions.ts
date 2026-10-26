/**
 * interactions — the page-wide "touchable glass" behavior, one delegated listener for everything.
 *
 * Spotlight: the [data-spotlight] element under the cursor gets the cursor's local position as
 * --spot-x / --spot-y (px) and --spot-nx / --spot-ny (-0.5..0.5), plus the class `is-lit`. CSS
 * draws a soft glow and a glowing edge there, and [data-tilt] elements lean toward it.
 *
 * Magnetic: every [data-magnetic] element within its pull radius gets --mag-x / --mag-y (how far to
 * lean toward the cursor) and --mag (0..1, how close it is). CSS moves and lights it.
 *
 * Writes at most once per animation frame. Installed only for a fine pointer: these are hover
 * effects. Reduced motion is honored in CSS, where the tilt and the magnetic lean are switched off
 * but the glow stays, since light is not motion.
 */

const PULL_RADIUS = 130;
// the furthest a magnetic element leans toward the cursor, in px
const MAX_LEAN = 10;

export function installInteractions(doc: Document = document): () => void {
    const win = doc.defaultView;
    if (!win || typeof win.matchMedia !== 'function' || !win.matchMedia('(pointer: fine)').matches) return () => {};

    const schedule = win.requestAnimationFrame?.bind(win) ?? ((cb: FrameRequestCallback) => win.setTimeout(() => cb(0), 16));
    const cancel = win.cancelAnimationFrame?.bind(win) ?? win.clearTimeout.bind(win);
    let frame: number | null = null;
    let last: { x: number; y: number; target: EventTarget | null } | null = null;
    let lit: HTMLElement | null = null;
    const pulled = new Set<HTMLElement>();

    const unlight = () => {
        if (!lit) return;
        lit.classList.remove('is-lit');
        lit = null;
    };

    const release = (el: HTMLElement) => {
        el.style.removeProperty('--mag-x');
        el.style.removeProperty('--mag-y');
        el.style.removeProperty('--mag');
        pulled.delete(el);
    };

    const update = () => {
        frame = null;
        if (!last) return;
        const { x, y, target } = last;

        // spotlight: the nearest lit-able ancestor of whatever is under the cursor
        const host = target instanceof Element ? (target.closest('[data-spotlight]') as HTMLElement | null) : null;
        if (host !== lit) unlight();
        if (host) {
            const r = host.getBoundingClientRect();
            host.style.setProperty('--spot-x', `${Math.round(x - r.left)}px`);
            host.style.setProperty('--spot-y', `${Math.round(y - r.top)}px`);
            host.style.setProperty('--spot-nx', String(Math.round(((x - r.left) / r.width - 0.5) * 100) / 100));
            host.style.setProperty('--spot-ny', String(Math.round(((y - r.top) / r.height - 0.5) * 100) / 100));
            host.classList.add('is-lit');
            lit = host;
        }

        // magnetic: few elements carry it (the logo, the main buttons), so measuring each is cheap
        doc.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
            const r = el.getBoundingClientRect();
            const dx = x - (r.left + r.width / 2);
            const dy = y - (r.top + r.height / 2);
            const dist = Math.hypot(dx, dy);
            if (dist > PULL_RADIUS) {
                if (pulled.has(el)) release(el);
                return;
            }
            const pull = 1 - dist / PULL_RADIUS;
            const scale = (pull * MAX_LEAN) / Math.max(dist, 1);
            el.style.setProperty('--mag-x', `${Math.round(dx * scale * 10) / 10}px`);
            el.style.setProperty('--mag-y', `${Math.round(dy * scale * 10) / 10}px`);
            el.style.setProperty('--mag', String(Math.round(pull * 100) / 100));
            pulled.add(el);
        });
    };

    const onMove = (e: PointerEvent) => {
        last = { x: e.clientX, y: e.clientY, target: e.target };
        if (frame === null) frame = schedule(update);
    };

    const onLeave = () => {
        last = null;
        unlight();
        [...pulled].forEach(release);
    };

    win.addEventListener('pointermove', onMove, { passive: true });
    doc.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
        win.removeEventListener('pointermove', onMove);
        doc.documentElement.removeEventListener('pointerleave', onLeave);
        if (frame !== null) cancel(frame);
        onLeave();
    };
}
