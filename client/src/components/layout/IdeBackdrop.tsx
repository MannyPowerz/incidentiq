import { useEffect, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { focusOf, initialState, stepN } from './ideScript';
import type { IdeState } from './ideScript';
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

// where the windows sit, as % of the backdrop, one arrangement per task. Every page's title is top
// left (the landing headline, the sign-in brand), so the windows keep to the right, the bottom and
// the corners. CSS clamps each one onto the screen.
export const LAYOUTS: Record<Win, Spot>[] = [
    { editor: { left: 60, top: 12 }, terminal: { left: 4, top: 72 }, problems: { left: 66, top: 66 } },
    { editor: { left: 56, top: 50 }, terminal: { left: 62, top: 12 }, problems: { left: 4, top: 76 } },
    { editor: { left: 30, top: 66 }, terminal: { left: 66, top: 40 }, problems: { left: 72, top: 12 } },
    { editor: { left: 4, top: 66 }, terminal: { left: 58, top: 68 }, problems: { left: 74, top: 30 } },
    { editor: { left: 62, top: 30 }, terminal: { left: 30, top: 74 }, problems: { left: 70, top: 10 } },
];

/**
 * IdeBackdrop — a developer's desktop behind every page: an editor, a terminal and the incidentioq
 * problems panel, floating as separate windows and doing real work on this app (ideScript.ts). At
 * each new task the windows glide to a new arrangement, the way someone moves windows around, and
 * the one being worked in comes to the front. The droplets float over them all.
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
    const place = (win: Win): CSSProperties => ({ '--x': `${layout[win].left}%`, '--y': `${layout[win].top}%` }) as CSSProperties;
    const frame = (win: Win) => `ide-win ide-win--${win}${focus === win ? ' is-focused' : ''}`;

    const lines = ide.files[ide.open]!;
    const { line: caretLine, col } = ide.caret;
    const from = Math.max(0, Math.min(caretLine - Math.floor(EDITOR_LINES / 2), lines.length - EDITOR_LINES));
    const problems = Object.entries(ide.marks);

    return (
        <div className="ide" aria-hidden="true">
            <div className={frame('editor')} style={place('editor')}>
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

            <div className={frame('terminal')} style={place('terminal')}>
                <span className="ide__title">zsh — incidentiq</span>
                <div className="ide__terminal">
                    {ide.terminal.map((t, i) => (
                        <code key={i} className={`ide__term ide__term--${t.kind}${t.typing ? ' is-typing' : ''}`}>
                            {t.text}
                        </code>
                    ))}
                </div>
            </div>

            <div className={frame('problems')} style={place('problems')}>
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
