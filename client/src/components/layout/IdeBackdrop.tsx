import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { focusOf, initialState, stepN } from './ideScript';
import type { IdeState } from './ideScript';
import { placeWindows, seeded } from './windowPlacement';
import type { Rect } from './windowPlacement';
import './IdeBackdrop.css';

// you drive: every this much cursor travel, scroll, key or click is this many steps of work
export const MOVE_PX = 14;
export const SCROLL_PX = 24;
export const KEY_STEPS = 2;
export const CLICK_STEPS = 4;
// stop interacting and it waits this long, then works by itself at one step per AUTO_MS
export const IDLE_MS = 3_000;
export const AUTO_MS = 70;
// reduced motion shows the session this far in: the proxy fixed, tests green, the commit made
export const STILL_STEPS = 260;
// the editor shows this many lines around the caret, like a window scrolled to where you are working
export const EDITOR_LINES = 9;

type Win = 'editor' | 'terminal' | 'problems';
type Spot = { left: number; top: number };

const WINS: Win[] = ['editor', 'terminal', 'problems'];
// what counts as the page's content: anything a person reads or uses inside <main>
const CONTENT = 'main :is(h1, h2, h3, p, a, button, input, select, textarea, label, tr, figure, li, [data-spotlight], .ui-card)';
// wait this long after a page change before measuring, so data that loads after the route (the rooms list) is on screen
export const SETTLE_MS = 500;

// the page's content as rects relative to the backdrop, skipping the backdrop itself, hidden text, and wrappers too big to steer around
function measureContent(box: DOMRect): Rect[] {
    const rects: Rect[] = [];
    for (const el of document.querySelectorAll(CONTENT)) {
        if (el.closest('.liquid')) continue;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area < 4 || area > box.width * box.height * 0.5) continue;
        if (r.bottom < box.top || r.top > box.bottom || r.right < box.left || r.left > box.right) continue;
        rects.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
    }
    return rects;
}

// the fallback when the page cannot be measured (no layout yet, or a test): as % of the backdrop, one arrangement per task. Every page keeps its text
// on the left (the landing headline, the sign-in brand and pitch), so the windows keep to the right
// and the bottom middle. CSS clamps each one onto the screen.
export const LAYOUTS: Record<Win, Spot>[] = [
    { editor: { left: 60, top: 12 }, terminal: { left: 42, top: 72 }, problems: { left: 70, top: 62 } },
    { editor: { left: 56, top: 50 }, terminal: { left: 62, top: 12 }, problems: { left: 44, top: 78 } },
    { editor: { left: 42, top: 66 }, terminal: { left: 66, top: 40 }, problems: { left: 72, top: 12 } },
    { editor: { left: 58, top: 58 }, terminal: { left: 60, top: 10 }, problems: { left: 44, top: 74 } },
    { editor: { left: 62, top: 30 }, terminal: { left: 42, top: 74 }, problems: { left: 70, top: 10 } },
];

/**
 * IdeBackdrop — a developer's desktop behind every page: an editor, a terminal and the incidentioq
 * problems panel, floating as separate windows and doing real work on this app (ideScript.ts). At
 * each new task, and on each new page, the windows glide to new spots found by measuring the page
 * (windowPlacement.ts): wherever its content leaves room, never twice the same. The one being worked
 * in comes to the front. The droplets float over them all.
 *
 * You drive it. Cursor travel, scrolling, typing and clicks each push the work along. Stop, and it
 * pauses. After IDLE_MS without input it carries on by itself until you come back. It starts on
 * autopilot, so a page never opens on a frozen screen. The windows drift with the cursor by depth,
 * the focused one most.
 *
 * It never shows what you type, so a password can never surface in it. Paused while the tab is
 * hidden. Under reduced motion it is one still picture of a session part-way through.
 */
export default function IdeBackdrop(): JSX.Element {
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [ide, setIde] = useState<IdeState>(() => (still ? stepN(initialState(), STILL_STEPS) : initialState()));
    // measured spots for this arrangement and this page; null until measured
    const [spots, setSpots] = useState<Record<Win, Spot> | null>(null);
    // bumped when the page or the window size changes, so the windows find new gaps
    const [pageKey, setPageKey] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const winRefs = { editor: useRef<HTMLDivElement>(null), terminal: useRef<HTMLDivElement>(null), problems: useRef<HTMLDivElement>(null) };

    useEffect(() => {
        let path = window.location.pathname;
        const changed = () => setPageKey((n) => n + 1);
        // a route change has no event outside the router, so the path is checked on a slow timer
        const watch = window.setInterval(() => {
            if (window.location.pathname !== path) {
                path = window.location.pathname;
                changed();
            }
        }, 400);
        window.addEventListener('resize', changed);
        return () => {
            window.clearInterval(watch);
            window.removeEventListener('resize', changed);
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const box = rootRef.current?.getBoundingClientRect();
            if (!box || box.width === 0) return;
            const sizes = WINS.map((w) => ({ w: winRefs[w].current?.offsetWidth ?? 0, h: winRefs[w].current?.offsetHeight ?? 0 }));
            const rects = placeWindows({ w: box.width, h: box.height }, sizes, measureContent(box), seeded(ide.layout * 7919 + pageKey + 1));
            setSpots({
                editor: { left: rects[0]!.x, top: rects[0]!.y },
                terminal: { left: rects[1]!.x, top: rects[1]!.y },
                problems: { left: rects[2]!.x, top: rects[2]!.y },
            });
        }, SETTLE_MS);
        return () => window.clearTimeout(timer);
        // the refs are stable; only a new task or a new page moves the windows
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ide.layout, pageKey]);

    useEffect(() => {
        if (still) return;
        // starts idle long ago, so autopilot runs from the first frame
        let lastInput = -Infinity;
        const work = (n: number) => {
            lastInput = Date.now();
            if (n > 0) setIde((s) => stepN(s, n));
        };

        const timer = window.setInterval(() => {
            if (!document.hidden && Date.now() - lastInput >= IDLE_MS) setIde((s) => stepN(s, 1));
        }, AUTO_MS);

        let travelled = 0;
        let last: { x: number; y: number } | null = null;
        const onMove = (e: PointerEvent) => {
            if (last) travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
            last = { x: e.clientX, y: e.clientY };
            const steps = Math.floor(travelled / MOVE_PX);
            travelled -= steps * MOVE_PX;
            work(steps);
        };

        let scrolled = 0;
        let lastY = window.scrollY;
        const onScroll = () => {
            scrolled += Math.abs(window.scrollY - lastY);
            lastY = window.scrollY;
            const steps = Math.floor(scrolled / SCROLL_PX);
            scrolled -= steps * SCROLL_PX;
            work(steps);
        };

        const onKey = () => work(KEY_STEPS);
        const onClick = () => work(CLICK_STEPS);

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onClick);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onClick);
        };
    }, [still]);

    const layout = LAYOUTS[ide.layout % LAYOUTS.length]!;
    const focus = focusOf(ide);
    const place = (win: Win): CSSProperties =>
        (spots
            ? { '--x': `${spots[win].left}px`, '--y': `${spots[win].top}px` }
            : { '--x': `${layout[win].left}%`, '--y': `${layout[win].top}%` }) as CSSProperties;
    const frame = (win: Win) => `ide-win ide-win--${win}${focus === win ? ' is-focused' : ''}`;

    const lines = ide.files[ide.open]!;
    const { line: caretLine, col } = ide.caret;
    const from = Math.max(0, Math.min(caretLine - Math.floor(EDITOR_LINES / 2), lines.length - EDITOR_LINES));
    const problems = Object.entries(ide.marks);

    return (
        <div ref={rootRef} className="ide" aria-hidden="true">
            <div ref={winRefs.editor} className={frame('editor')} style={place('editor')}>
                <div className="ide__tabs">
                    {ide.tabs.map((t) => (
                        <span key={t} className={`ide__tab${t === ide.open ? ' is-open' : ''}`}>
                            {t}
                        </span>
                    ))}
                </div>
                <div className="ide__code">
                    {lines.slice(from, from + EDITOR_LINES).map((text, n) => {
                        const i = from + n;
                        const mark = ide.marks[`${ide.open}:${i}`];
                        const active = i === caretLine;
                        return (
                            <div key={i} className={`ide__line${active ? ' is-active' : ''}${mark ? ` is-${mark}` : ''}`}>
                                <span className="ide__gutter">{i + 1}</span>
                                <code>
                                    {active ? (
                                        <>
                                            {text.slice(0, col)}
                                            <span className="ide__caret" />
                                            {text.slice(col)}
                                        </>
                                    ) : (
                                        text
                                    )}
                                </code>
                            </div>
                        );
                    })}
                </div>
                <div className="ide__status">
                    <span>ui/live</span>
                    <span>
                        Ln {caretLine + 1}, Col {col + 1}
                    </span>
                </div>
            </div>

            <div ref={winRefs.terminal} className={frame('terminal')} style={place('terminal')}>
                <span className="ide__title">zsh — incidentiq</span>
                <div className="ide__terminal">
                    {ide.terminal.map((t, i) => (
                        <code key={i} className={`ide__term ide__term--${t.kind}${t.typing ? ' is-typing' : ''}`}>
                            {t.text}
                        </code>
                    ))}
                </div>
            </div>

            <div ref={winRefs.problems} className={frame('problems')} style={place('problems')}>
                <span className="ide__title ide__watch">incidentioq · watching</span>
                {problems.length === 0 ? (
                    <code className="ide__problem">no silent failures</code>
                ) : (
                    problems.map(([where, mark]) => {
                        const [file, line] = where.split(':');
                        return (
                            <code key={where} className={`ide__problem is-${mark}`}>
                                {file}:{Number(line) + 1} {mark === 'ok' ? 'fixed' : 'flagged'}
                            </code>
                        );
                    })
                )}
            </div>
        </div>
    );
}
