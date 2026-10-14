import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import AuthForm from "../components/auth/AuthForm";
import HeroGate from "../components/hero/HeroGate";
import LiquidBackdrop from "../components/layout/LiquidBackdrop";
import { BrandMark, ThemeToggle, Wordmark } from "../components/ui";
import "./SignInPage.css"

const TILT_MAX_DEG = 8;

/**
 * Tilts the hero toward the pointer: one listener on the panel, two CSS variables, the transform
 * lives in CSS. Skipped entirely under reduced motion, which is the only branch that matters here.
 */
function useTilt() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            el.style.setProperty('--tilt-x', `${(-y * TILT_MAX_DEG).toFixed(2)}deg`);
            el.style.setProperty('--tilt-y', `${(x * TILT_MAX_DEG).toFixed(2)}deg`);
        };
        // removed rather than zeroed, so the page-wide lean toward the cursor takes over again
        const onLeave = () => {
            el.style.removeProperty('--tilt-x');
            el.style.removeProperty('--tilt-y');
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
        };
    }, []);
    return ref;
}

/**
 * SignInPage — the one cinematic screen. The brand panel carries the mesh gradient and the hero
 * shape; the form stays a solid card, because it is content, not chrome (design-system.md §2.7).
 * The hero is 3D on desktop (lazy-loaded) and this CSS shape everywhere else.
 */
export default function SignInPage() : JSX.Element {
    const tiltRef = useTilt();

    return (
        <main className="sign-in-page">
            {/* one backdrop behind both halves, so the brand panel and the form read as one page */}
            <LiquidBackdrop intensity="full" />
            <section className="sign-in-brand" aria-label="IncidentIOQ">

                <div className="sign-in-brand__lockup brand" data-magnetic>
                    <BrandMark size="md" />
                    <p className="sign-in-brand__name">
                        <Wordmark />
                    </p>
                </div>

                <p className="sign-in-brand__tagline">Detect. Collaborate. Resolve.</p>

                <div ref={tiltRef} className="sign-in-brand__hero" aria-hidden="true">
                    {/* the CSS shape is the fallback for every case the 3D one can't serve (HeroGate.tsx) */}
                    <HeroGate fallback={<span className="sign-in-brand__shape" />} />
                </div>

                <p className="sign-in-brand__pitch">
                    One room per incident. Every observation, action, and AI draft in order — and the teammate who knows the code, flagged.
                </p>
            </section>

            <section className="sign-in-form">
                <div className="sign-in-form__theme">
                    <ThemeToggle />
                </div>
                <AuthForm />
            </section>
        </main>
    );
}
