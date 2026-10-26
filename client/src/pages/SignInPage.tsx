import type { JSX } from 'react';
import AuthForm from "../components/auth/AuthForm";
import LiquidBackdrop from "../components/layout/LiquidBackdrop";
import { BrandMark, ThemeToggle, Wordmark } from "../components/ui";
import "./SignInPage.css"

/**
 * SignInPage — the one cinematic screen. The brand panel carries the hero: the scanner lens from the
 * logo at full size, tilting to the cursor and watching the form beside it (SignInPage.css). The form
 * is the glass sheet (design-system.md §2.7).
 */
export default function SignInPage() : JSX.Element {
    return (
        <main className="sign-in-page">
            <section className="sign-in-brand" aria-label="IncidentIOQ">
                <div className="sign-in-brand__mesh" aria-hidden="true">
                    <span className="sign-in-brand__blob sign-in-brand__blob--1" />
                    <span className="sign-in-brand__blob sign-in-brand__blob--2" />
                    <span className="sign-in-brand__blob sign-in-brand__blob--3" />
                </div>

                <div className="sign-in-brand__lockup">
                    <span className="sign-in-brand__mark" aria-hidden="true" />
                    <p className="sign-in-brand__name">IncidentIOQ</p>
                </div>

                <p className="sign-in-brand__tagline">Detect. Collaborate. Resolve.</p>

                <div className="sign-in-brand__hero" aria-hidden="true" data-backdrop-clear>
                    <BrandMark size="xl" interactive />
                </div>

                <p className="sign-in-brand__pitch">
                    One room per incident. Every observation, action, and AI draft in order, and the teammate who knows the code, flagged.
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
