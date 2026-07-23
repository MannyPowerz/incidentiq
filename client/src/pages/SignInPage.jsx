import AuthForm from "../components/auth/AuthForm";

export default function SignInPage() {
    // Display reusable authetication form
    return (
        <main className="sign-in-page">
            <div className="background-glow background-glow-left" />
            <div className="background-glow background-glow-right"/>

            <section className="sign-in-content">
                {/* Display logo at the top */}
                <header className="sign-in-brand">
                    <div className="logo" aria-hidden="true">
                        <span className="logo-center" />
                    </div>

                    <div className="logo-text">
                        <p className="logo-name">
                            Incident<span>IQ</span>
                        </p>
                        <p className="logo-tagline">
                            Detect. Collaborate. Resolve.
                        </p>
                    </div>
                </header>

                <AuthForm />
            </section>
        </main>
    );
}