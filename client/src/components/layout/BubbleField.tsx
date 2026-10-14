import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { bubbleCount, makeBubbles, position, repel } from './bubbleMath';
import type { Bubble } from './bubbleMath';

type Palette = { tints: string[]; highlight: string };

// tokens, read off the page, so the bubbles change with the theme and stay within what tokens.test.ts checks
function readPalette(): Palette {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    return { tints: [v('--mesh-1'), v('--mesh-2'), v('--mesh-3'), v('--color-primary')], highlight: v('--liquid-highlight') };
}

// "#3730A3" or "rgb(...)" -> "rgba(r, g, b, a)"
function withAlpha(color: string, alpha: number): string {
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const n = parseInt(hex[1]!, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    const rgb = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, b: Bubble, p: Palette): void {
    const tint = p.tints[b.hue] ?? p.tints[0]!;
    // glass: clear in the middle, the color gathering at the rim, as light does in a real bubble
    const body = ctx.createRadialGradient(x, y, b.r * 0.2, x, y, b.r);
    body.addColorStop(0, withAlpha(tint, 0));
    body.addColorStop(0.75, withAlpha(tint, 0.06));
    body.addColorStop(1, withAlpha(tint, 0.28));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = b.r > 14 ? 1.2 : 0.8;
    ctx.strokeStyle = withAlpha(tint, 0.45);
    ctx.stroke();
    // the specular highlight, the same token as the glass droplets' gloss
    if (b.r > 6) {
        ctx.fillStyle = p.highlight;
        ctx.beginPath();
        ctx.ellipse(x - b.r * 0.38, y - b.r * 0.42, b.r * 0.22, b.r * 0.12, -0.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * BubbleField — an endless field of glass bubbles of every size, on a canvas behind the content.
 * They stream past as you scroll (nearer ones faster), drift with the cursor by depth, part around
 * it, and wrap so the field never runs out. A canvas rather than elements: dozens of blurred glass
 * elements would cost the GPU every frame; a few dozen gradient circles cost almost nothing.
 *
 * Stops drawing while the tab is hidden, draws one still frame under reduced motion, and follows
 * the theme by re-reading its tokens whenever <html data-theme> changes.
 */
export default function BubbleField({ density = 1 }: { density?: number }): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let palette = readPalette();
        let bubbles: Bubble[] = [];
        let width = 0;
        let height = 0;
        const pointer = { x: -9999, y: -9999, px: 0, py: 0, ex: 0, ey: 0 };
        let frame: number | null = null;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            bubbles = makeBubbles(bubbleCount(width, height, density));
        };

        const draw = (time: number) => {
            // ease the cursor lean, so the field follows like liquid instead of snapping
            pointer.ex += (pointer.px - pointer.ex) * 0.06;
            pointer.ey += (pointer.py - pointer.ey) * 0.06;
            ctx.clearRect(0, 0, width, height);
            const f = { width, height, scrollY: window.scrollY, time: still ? 0 : time, px: pointer.ex, py: pointer.ey };
            for (const b of bubbles) {
                const at = position(b, f);
                const away = repel(at.x, at.y, pointer.x, pointer.y);
                drawBubble(ctx, at.x + away.dx, at.y + away.dy, b, palette);
            }
        };

        const loop = (time: number) => {
            draw(time);
            frame = still || document.hidden ? null : requestAnimationFrame(loop);
        };
        const start = () => {
            if (frame === null && !document.hidden) frame = requestAnimationFrame(loop);
        };

        const onMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;
            pointer.px = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.py = (e.clientY / window.innerHeight) * 2 - 1;
        };
        const onLeave = () => {
            pointer.x = pointer.y = -9999;
            pointer.px = pointer.py = 0;
        };
        // reduced motion: no loop, so redraw once on the events that change the picture
        const redrawStill = () => draw(0);

        resize();
        const observer = new MutationObserver(() => {
            palette = readPalette();
            if (still) redrawStill();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', start);
        if (still) {
            redrawStill();
            window.addEventListener('resize', redrawStill);
        } else {
            window.addEventListener('pointermove', onMove, { passive: true });
            document.documentElement.addEventListener('pointerleave', onLeave);
            start();
        }

        return () => {
            if (frame !== null) cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('resize', redrawStill);
            document.removeEventListener('visibilitychange', start);
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
        };
    }, [density]);

    return <canvas ref={canvasRef} className="liquid__bubbles" aria-hidden="true" />;
}
