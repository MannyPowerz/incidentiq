import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { initialState, stepN } from './ideScript';
import type { IdeState } from './ideScript';
import './IdeBackdrop.css';

// you drive: every this much cursor travel, scroll, key or click is this many steps of work
export const MOVE_PX = 14;
export const SCROLL_PX = 24;
export const KEY_STEPS = 2;
export const CLICK_STEPS = 4;
// stop interacting and it waits this long, then works by itself at one step per AUTO_MS
export const IDLE_MS = 10_000;
export const AUTO_MS = 70;
// reduced motion shows the session this far in: the proxy fixed, tests green, the commit made
export const STILL_STEPS = 260;

/**
 * IdeBackdrop — one faint IDE behind every page: file tabs, an editor with line numbers, a terminal
 * and a status bar, doing a developer's work on this app (ideScript.ts). The droplets float over it.
 *
 * You drive it. Cursor travel, scrolling, typing and clicks each push the work along, and the caret
 * glides to your cursor, so the work happens where you are. Stop, and it
 * pauses. After IDLE_MS without input it carries on by itself until you come back. It starts on
 * autopilot, so a page never opens on a frozen screen.
 *
 * It never shows what you type, so a password can never surface in it. Paused while the tab is
 * hidden. Under reduced motion it is one still picture of a session part-way through.
 */
export default function IdeBackdrop(): JSX.Element {
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [ide, setIde] = useState<IdeState>(() => (still ? stepN(initialState(), STILL_STEPS) : initialState()));
    const editorRef = useRef<HTMLDivElement>(null);

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
            // the caret follows the cursor, so the typing happens where you are
            const box = editorRef.current?.getBoundingClientRect();
            if (box) {
                editorRef.current!.style.setProperty('--ide-x', `${Math.round(e.clientX - box.left)}px`);
                editorRef.current!.style.setProperty('--ide-y', `${Math.round(e.clientY - box.top)}px`);
            }
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

    const lines = ide.files[ide.open]!;
    const { line: caretLine, col } = ide.caret;

    return (
        <div className="ide" aria-hidden="true">
            <div className="ide__tabs">
                {ide.tabs.map((t) => (
                    <span key={t} className={`ide__tab${t === ide.open ? ' is-open' : ''}`}>
                        {t}
                    </span>
                ))}
            </div>
            <div ref={editorRef} className="ide__editor">
                <div className="ide__code" style={{ '--caret-line': caretLine, '--caret-col': col } as CSSProperties}>
                    {lines.map((text, i) => {
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
            </div>
            <div className="ide__terminal">
                <span className="ide__panel-title">Terminal</span>
                {ide.terminal.map((t, i) => (
                    <code key={i} className={`ide__term ide__term--${t.kind}${t.typing ? ' is-typing' : ''}`}>
                        {t.text}
                    </code>
                ))}
            </div>
            <div className="ide__status">
                <span>ui/live</span>
                <span>
                    Ln {caretLine + 1}, Col {col + 1}
                </span>
                <span className="ide__watch">incidentioq watching</span>
            </div>
        </div>
    );
}
