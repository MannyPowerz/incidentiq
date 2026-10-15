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
