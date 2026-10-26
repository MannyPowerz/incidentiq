/**
 * pointerField — where the cursor is, for the whole page, as two CSS variables on <html>:
 * --pointer-x and --pointer-y, each from -1 (left/top) to 1 (right/bottom), 0 at the center.
 *
 * Decorative things read them in CSS to react to the cursor anywhere on screen: backdrop droplets
 * drift at different depths, their highlight follows the light, logo lenses tip toward it. Content
 * never reads them, so text stays still to read.
 *
 * One listener, and at most one write per animation frame. Installed only for a fine pointer (a
 * mouse or trackpad) and when the user has not asked for reduced motion, so touch screens and
 * reduced-motion users get a still page, with the variables left at their 0 fallback.
 */

const X = '--pointer-x';
const Y = '--pointer-y';

const prefers = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

export function shouldInstall(): boolean {
    return prefers('(pointer: fine)') && !prefers('(prefers-reduced-motion: reduce)');
}

// rounded so tiny jitter does not restyle the page; two decimals is far finer than a pixel of motion
const round = (n: number) => Math.round(n * 100) / 100;

export function installPointerField(root: HTMLElement = document.documentElement): () => void {
    if (!shouldInstall()) return () => {};

    const schedule = window.requestAnimationFrame?.bind(window) ?? ((cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16));
    const cancel = window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout.bind(window);
    let frame: number | null = null;
    let latest = { x: 0, y: 0 };

    const write = () => {
        frame = null;
        root.style.setProperty(X, String(latest.x));
        root.style.setProperty(Y, String(latest.y));
    };

    const onMove = (e: PointerEvent) => {
        latest = {
            x: round((e.clientX / window.innerWidth) * 2 - 1),
            y: round((e.clientY / window.innerHeight) * 2 - 1),
        };
        // coalesce: however many events arrive in a frame, the page restyles once
        if (frame === null) frame = schedule(write);
    };

    // leaving the window settles everything back to rest rather than freezing mid-lean
    const onLeave = () => {
        latest = { x: 0, y: 0 };
        if (frame === null) frame = schedule(write);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        if (frame !== null) cancel(frame);
        root.style.removeProperty(X);
        root.style.removeProperty(Y);
    };
}
