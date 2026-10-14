import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import AuthForm from "../components/auth/AuthForm";
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
        const onLeave = () => {
            el.style.setProperty('--tilt-x', '0deg');
            el.style.setProperty('--tilt-y', '0deg');
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
 * Item 10 swaps the static shape for the lazy-loaded 3D hero and keeps this as its fallback.
 */
export default function SignInPage() : JSX.Element {
    const tiltRef = useTilt();

    return (
        <main className="sign-in-page">
            <section className="sign-in-brand" aria-label="IncidentIQ">
                <div className="sign-in-brand__mesh" aria-hidden="true">
                    <span className="sign-in-brand__blob sign-in-brand__blob--1" />
                    <span className="sign-in-brand__blob sign-in-brand__blob--2" />
                    <span className="sign-in-brand__blob sign-in-brand__blob--3" />
                </div>

                <div className="sign-in-brand__lockup">
                    <span className="sign-in-brand__mark" aria-hidden="true" />
                    <p className="sign-in-brand__name">IncidentIQ</p>
                </div>

                <p className="sign-in-brand__tagline">Detect. Collaborate. Resolve.</p>

                <div ref={tiltRef} className="sign-in-brand__hero" aria-hidden="true">
                    <span className="sign-in-brand__shape" />
                </div>

                <p className="sign-in-brand__pitch">
                    One room per incident. Every observation, action, and AI draft in order — and the teammate who knows the code, flagged.
                </p>
            </section>

            <section className="sign-in-form">
                <AuthForm />
            </section>
        </main>
    );
}
