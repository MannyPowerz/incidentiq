/**
 * pointerField.test.ts — the page-wide cursor position: installed only for a mouse or trackpad with
 * motion allowed, normalized to -1..1, written at most once per frame, and settled back to rest
 * when the cursor leaves the window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installPointerField, shouldInstall } from './pointerField';

function stubMedia({ fine = true, reduced = false } = {}) {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('pointer: fine') ? fine : q.includes('reduced-motion') ? reduced : false }));
}

// frames run only when the test says so, so coalescing can be observed
let frames: FrameRequestCallback[] = [];
const flushFrame = () => {
    const run = frames;
    frames = [];
    run.forEach((cb) => cb(0));
};

const vars = (root: HTMLElement) => [root.style.getPropertyValue('--pointer-x'), root.style.getPropertyValue('--pointer-y')];
const move = (x: number, y: number) => window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y }));

let root: HTMLElement;
let uninstall: () => void = () => {};

beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    root = document.createElement('div');
});

afterEach(() => {
    uninstall();
    vi.unstubAllGlobals();
});

describe('pointerField', () => {
    it('installs for a mouse with motion allowed, and not for touch or reduced motion', () => {
        stubMedia();
        expect(shouldInstall()).toBe(true);
        stubMedia({ fine: false });
        expect(shouldInstall()).toBe(false);
        stubMedia({ reduced: true });
        expect(shouldInstall()).toBe(false);
    });

    it('writes the cursor as -1..1 from the center', () => {
        stubMedia();
        uninstall = installPointerField(root);

        move(1000, 0);
        flushFrame();
        expect(vars(root)).toEqual(['1', '-1']);

        move(500, 400);
        flushFrame();
        expect(vars(root)).toEqual(['0', '0']);
    });

    // many events in one frame must restyle the page once, with the latest position
    it('coalesces every move within a frame into one write', () => {
        stubMedia();
        uninstall = installPointerField(root);

        move(100, 100);
        move(200, 200);
        move(750, 600);
        expect(frames).toHaveLength(1);
        flushFrame();

        expect(vars(root)).toEqual(['0.5', '0.5']);
    });

    it('settles back to rest when the cursor leaves the window', () => {
        stubMedia();
        uninstall = installPointerField(root);
        move(1000, 800);
        flushFrame();

        document.documentElement.dispatchEvent(new Event('pointerleave'));
        flushFrame();

        expect(vars(root)).toEqual(['0', '0']);
    });

    it('does nothing at all for reduced motion', () => {
        stubMedia({ reduced: true });
        uninstall = installPointerField(root);
        move(1000, 800);
        flushFrame();
        expect(vars(root)).toEqual(['', '']);
    });

    it('removes its listener and its variables when uninstalled', () => {
        stubMedia();
        uninstall = installPointerField(root);
        move(1000, 800);
        flushFrame();
        uninstall();
        uninstall = () => {};

        move(0, 0);
        flushFrame();
        expect(vars(root)).toEqual(['', '']);
    });
});
