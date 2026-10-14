/**
 * interactions.test.ts — spotlight lights exactly the surface under the cursor (and unlights the
 * last one), magnetic elements lean toward a nearby cursor and let go when it moves away, and none
 * of it installs on a touch screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installInteractions } from './interactions';

let frames: FrameRequestCallback[] = [];
const flush = () => {
    const run = frames;
    frames = [];
    run.forEach((cb) => cb(0));
};

function box(el: HTMLElement, left: number, top: number, width: number, height: number) {
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} });
}

function moveOver(target: Element, x: number, y: number) {
    const e = new Event('pointermove', { bubbles: true });
    Object.assign(e, { clientX: x, clientY: y });
    target.dispatchEvent(e);
    flush();
}

let uninstall: () => void = () => {};

beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('pointer: fine') }));
    document.body.innerHTML = `
        <section id="a" data-spotlight><p id="a-text">card a</p></section>
        <section id="b" data-spotlight>card b</section>
        <a id="logo" data-magnetic>logo</a>`;
    box(document.getElementById('a')!, 0, 0, 200, 100);
    box(document.getElementById('b')!, 300, 0, 200, 100);
    box(document.getElementById('logo')!, 600, 0, 40, 40);
});

afterEach(() => {
    uninstall();
    vi.unstubAllGlobals();
});

const style = (id: string, prop: string) => document.getElementById(id)!.style.getPropertyValue(prop);
const lit = (id: string) => document.getElementById(id)!.classList.contains('is-lit');

describe('interactions', () => {
    it('lights the spotlight surface under the cursor, even from a child, with local coordinates', () => {
        uninstall = installInteractions();
        moveOver(document.getElementById('a-text')!, 150, 25);

        expect(lit('a')).toBe(true);
        expect([style('a', '--spot-x'), style('a', '--spot-y')]).toEqual(['150px', '25px']);
        expect([style('a', '--spot-nx'), style('a', '--spot-ny')]).toEqual(['0.25', '-0.25']);
    });

    it('unlights the previous surface when the cursor moves to another', () => {
        uninstall = installInteractions();
        moveOver(document.getElementById('a')!, 10, 10);
        moveOver(document.getElementById('b')!, 310, 10);

        expect(lit('a')).toBe(false);
        expect(lit('b')).toBe(true);
    });

    it('pulls a magnetic element toward a nearby cursor, and releases it when the cursor goes', () => {
        uninstall = installInteractions();
        // logo center is (620, 20); the cursor is 60px to its right
        moveOver(document.body, 680, 20);
        expect(parseFloat(style('logo', '--mag-x'))).toBeGreaterThan(0);
        expect(style('logo', '--mag-y')).toBe('0px');
        expect(Number(style('logo', '--mag'))).toBeGreaterThan(0.4);

        moveOver(document.body, 1200, 600);
        expect(style('logo', '--mag-x')).toBe('');
    });

    it('lets go of everything when the cursor leaves the window', () => {
        uninstall = installInteractions();
        moveOver(document.getElementById('a')!, 10, 10);
        moveOver(document.body, 625, 20);

        document.documentElement.dispatchEvent(new Event('pointerleave'));

        expect(lit('a')).toBe(false);
        expect(style('logo', '--mag')).toBe('');
    });

    it('does not install on a touch screen', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        uninstall = installInteractions();
        moveOver(document.getElementById('a')!, 10, 10);
        expect(lit('a')).toBe(false);
    });
});
