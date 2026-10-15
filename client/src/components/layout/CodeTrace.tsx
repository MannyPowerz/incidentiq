import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { STORIES, FADE, lifetime, reveal } from './traceScript';
import './CodeTrace.css';

// where panes can sit, as % of the backdrop; near the edges, so they stay behind the content's margins.
// Pane i only ever uses slots i, i + panes, i + 2 * panes..., so two panes can never land in one spot.
const SLOTS = [
    { left: 3, top: 12, depth: 1.2 },
    { left: 66, top: 9, depth: 0.6 },
    { left: 70, top: 56, depth: 1.5 },
    { left: 4, top: 60, depth: 0.9 },
    { left: 36, top: 78, depth: 0.5 },
    { left: 80, top: 30, depth: 0.8 },
];

// on its own the background works slowly; your typing and cursor are what make it type
export const TICK_MS = 120;
// a key press types this many characters into the pane being typed
const KEY_PUSH = 3;
// and every this many pixels of cursor travel type one more
export const MOVE_PX = 18;
// a click's terminal line stays this long, and no more than MAX_ECHOES are up at once
const ECHO_MS = 1800;
const MAX_ECHOES = 3;

// what a click prints: the steps of the product's loop, never anything the user typed
export const ECHOES = ['stored, then broadcast', 'entry #43 ordered by id', 'scanner: 0 silent failures', 'draft confirmed by a human', 'refetched the gap from the db'];

type Pane = { story: number; slot: number; tick: number };
type Echo = { id: number; x: number; y: number; text: string };

function startingPanes(count: number, still: boolean): Pane[] {
    // staggered, so the panes never all type at once; still: every pane shows its whole story
    return Array.from({ length: count }, (_, i) => {
        const story = i % STORIES.length;
        return { story, slot: i, tick: still ? lifetime(STORIES[story]!) - FADE - 1 : -i * 60 };
    });
}

/**
 * CodeTrace — faint editor and terminal panes behind the page that, every now and then, play out a
 * failure this app catches: code is typed, the scanner flags it, a fix lands as a diff, a check
 * turns green. Then the pane fades and comes back somewhere else with the next story.
 *
 * It answers the page, as if a developer were working along with you: typing anywhere and moving
 * the cursor both type the code (it never shows what you type, so a password can never surface
 * here), a click prints one step of the product's loop where you clicked, and the panes drift with
 * the cursor by depth through the page-wide pointer field.
 *
 * Plain elements, so the text is crisp; at most three panes, so it stays calm. Stops while the tab
 * is hidden. Under reduced motion every pane shows its finished story and nothing moves.
 */
export default function CodeTrace({ panes: count = 3 }: { panes?: number }): JSX.Element {
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [panes, setPanes] = useState<Pane[]>(() => startingPanes(count, still));
    const [echoes, setEchoes] = useState<Echo[]>([]);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (still) return;

        const advance = (by: number, typingOnly: boolean) =>
            setPanes((all) =>
                all.map((p, i) => {
                    const story = STORIES[p.story]!;
                    if (typingOnly && !reveal(story, p.tick).some((l) => l.typing)) return p;
                    const tick = p.tick + by;
                    if (tick < lifetime(story)) return { ...p, tick };
                    // done: the next story this pane has not shown, at this pane's next slot
                    const next = p.slot + all.length;
                    return { story: (p.story + all.length) % STORIES.length, slot: next < SLOTS.length ? next : i, tick: 0 };
                }),
            );

        const timer = window.setInterval(() => {
            if (!document.hidden) advance(1, false);
        }, TICK_MS);

        const onKey = () => advance(KEY_PUSH, true);

        // cursor travel types too, so moving around reads as the background coding along with you
        let travelled = 0;
        let last: { x: number; y: number } | null = null;
        const onMove = (e: PointerEvent) => {
            if (last) travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
            last = { x: e.clientX, y: e.clientY };
            const steps = Math.floor(travelled / MOVE_PX);
            if (steps > 0) {
                travelled -= steps * MOVE_PX;
                advance(steps, true);
            }
        };

        let nextId = 0;
        const onClick = (e: MouseEvent) => {
            const box = rootRef.current?.getBoundingClientRect();
            if (!box) return;
            const echo = { id: nextId++, x: e.clientX - box.left, y: e.clientY - box.top, text: ECHOES[nextId % ECHOES.length]! };
            setEchoes((all) => [...all.slice(-(MAX_ECHOES - 1)), echo]);
            window.setTimeout(() => setEchoes((all) => all.filter((x) => x.id !== echo.id)), ECHO_MS);
        };

        window.addEventListener('keydown', onKey);
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onClick);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onClick);
        };
    }, [still]);

    return (
        <div ref={rootRef} className="trace" aria-hidden="true">
            {panes.map((p, i) => {
                if (p.tick < 0) return null;
                const story = STORIES[p.story]!;
                const slot = SLOTS[p.slot]!;
                const leaving = p.tick >= lifetime(story) - FADE;
                return (
                    <div
                        // a new key per story, so each one enters with the pane's arrival animation
                        key={`${i}-${p.story}-${p.slot}`}
                        className={`trace__pane trace__pane--${story.pane}${leaving ? ' is-leaving' : ''}`}
                        style={{ left: `${slot.left}%`, top: `${slot.top}%`, '--depth': slot.depth } as CSSProperties}
                    >
                        <div className="trace__bar">
                            <i />
                            <i />
                            <i />
                            <span>{story.title}</span>
                        </div>
                        {reveal(story, p.tick).map((line, n) => (
                            <code key={n} className={`trace__line trace__line--${line.kind}${line.typing ? ' is-typing' : ''}`}>
                                {line.text}
                            </code>
                        ))}
                    </div>
                );
            })}
            {echoes.map((e) => (
                <code key={e.id} className="trace__echo" style={{ left: e.x, top: e.y }}>
                    {e.text}
                </code>
            ))}
        </div>
    );
}
