import type { JSX } from "react";
import AuthForm from "../components/auth/AuthForm";
import "./SignInPage.css"

/**
 * SignInPage — brand panel beside the form at desktop, brand above the form on phones.
 * The brand panel's shape is a static stand-in: Item 10 swaps it for the lazy-loaded 3D hero and
 * keeps this exact shape as that component's reduced-motion fallback.
 */
export default function SignInPage() : JSX.Element {
    return (
        <main className="sign-in-page">
            <section className="sign-in-brand" aria-label="IncidentIQ">
                <div className="sign-in-brand__lockup">
                    <span className="sign-in-brand__mark" aria-hidden="true" />
                    <p className="sign-in-brand__name">IncidentIQ</p>
                </div>

                <p className="sign-in-brand__tagline">Detect. Collaborate. Resolve.</p>

                <div className="sign-in-brand__hero" aria-hidden="true">
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
