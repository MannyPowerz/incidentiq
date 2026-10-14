/**
 * LandingPage — what a signed-out visitor sees at "/". Built from the Oct 8 liquid-glass prompts:
 * glass navbar with a sliding indicator, a hero card that tilts and stretches toward the cursor,
 * a glass stats bar, feature cards, how-it-works, team voices, a sign-up box, and a footer.
 *
 * Motion drives the movement. MotionConfig reducedMotion="user" turns off transforms for anyone who
 * asked for less motion, while fades still run. Loaded lazily (HomeGate), so signed-in screens never
 * download it.
 *
 * Every claim here is true of the product today. The two parts still being built are tagged as such,
 * and the team voices are labeled illustrative, because there are no customers to quote yet.
 */

import { useEffect, useState } from 'react';
import type { FormEvent, JSX, PointerEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MotionConfig, motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import type { AuthHandoff } from '../components/auth/AuthForm';
import { BrandMark, ThemeToggle, Wordmark } from '../components/ui';
import LiquidBackdrop from '../components/layout/LiquidBackdrop';
import './LandingPage.css';

const NAV = [
    { id: 'features', label: 'Features' },
    { id: 'how', label: 'How it works' },
    { id: 'teams', label: 'Teams' },
];

// facts about how the product is built, not usage numbers we don't have
const STATS = [
    { value: '0', label: 'auto-posts. A human always decides' },
    { value: '1', label: 'live room per incident' },
    { value: '3', label: 'signals behind every relevance flag' },
    { value: '100%', label: 'of reads scoped to your team' },
];

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
    {
        title: 'Live war rooms',
        body: 'One room per incident. Every observation, action and finding lands in order, for everyone, the moment it is saved.',
        icon: <path d="M4 12h3l2-6 4 12 2-6h5" />,
    },
    {
        title: 'AI explains, you decide',
        body: 'Paste a log and get a summary, why it matters, and a likely fix. Nothing is posted until an engineer confirms it.',
        icon: (
            <>
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                <circle cx="12" cy="12" r="4" />
            </>
        ),
    },
    {
        title: 'Works-on-my-machine diffs',
        body: 'Node version, lockfile hash and applied migrations for every teammate, side by side, with the difference highlighted.',
        icon: (
            <>
                <rect x="3" y="5" width="7" height="14" rx="1.5" />
                <rect x="14" y="5" width="7" height="14" rx="1.5" />
                <path d="M10 12h4" />
            </>
        ),
    },
];

const STEPS: { title: string; body: string; status?: string }[] = [
    { title: 'The scanner notices', body: 'A local agent watches ports, interfaces and your environment for failures that never throw an error.', status: 'In development' },
    { title: 'You post it', body: 'The scanner shows you a private card. Nothing reaches the team until you choose to post it.' },
    { title: 'Everyone sees it live', body: 'The entry is saved first, then broadcast, so every teammate sees the same timeline in the same order.' },
    { title: 'AI explains, you confirm', body: 'Ask for a draft explanation. Confirming puts your name on it; rejecting deletes it.' },
    { title: 'The right teammate is flagged', body: 'Recent, frequent and long-term work on the affected code decide who is most likely to know.', status: 'In development' },
];

// illustrative, not customer quotes: written to show who it is for, from solo devs to platform teams
const VOICES = [
    { who: 'Solo developer', quote: 'I lost an afternoon to a VPN quietly eating localhost. A tool that says "it is your network, not your code" would have saved it.' },
    { who: 'Startup, 6 engineers', quote: 'When staging breaks we land in one room instead of five Slack threads, and the timeline already is the postmortem.' },
    { who: 'Scale-up, 40 engineers', quote: 'A broken migration should reach the person who wrote it without anyone having to know who to ping.' },
    { who: 'Platform team, 300 engineers', quote: 'AI can draft the explanation, but nothing posts until an engineer confirms it. That is the only way we would trust it.' },
];

// the section in view, so the nav indicator follows the reader down the page
function useActiveSection(ids: string[]): string | null {
    const [active, setActive] = useState<string | null>(null);
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visible) setActive(visible.target.id);
            },
            { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [ids]);
    return active;
}

// the hero card leans toward the cursor and stretches slightly, on springs so it feels weighted
function TiltCard({ children }: { children: ReactNode }): JSX.Element {
    const px = useMotionValue(0);
    const py = useMotionValue(0);
    const spring = { stiffness: 160, damping: 18 };
    const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), spring);
    const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), spring);
    const scaleX = useSpring(useTransform(px, [-0.5, 0, 0.5], [1.012, 1, 1.012]), spring);

    function onMove(e: PointerEvent<HTMLDivElement>) {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
    }

    return (
        <motion.div
            className="landing-hero__card ui-glass"
            style={{ rotateX, rotateY, scaleX, transformPerspective: 1100 }}
            onPointerMove={onMove}
            onPointerLeave={() => {
                px.set(0);
                py.set(0);
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
        >
            {children}
        </motion.div>
    );
}

function Reveal({ children, id, className }: { children: ReactNode; id?: string; className?: string }): JSX.Element {
    return (
        <motion.section
            id={id}
            className={className}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            // not once: sections animate in on the way down and again on the way back up
            viewport={{ once: false, amount: 0.15 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        >
            {children}
        </motion.section>
    );
}

export default function LandingPage(): JSX.Element {
    const active = useActiveSection(NAV.map((n) => n.id));
    const [hovered, setHovered] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const indicatorOn = hovered ?? active;
    // scroll-linked motion: a progress bar, and the hero drifting up and fading as you leave it
    const { scrollY, scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
    const heroY = useTransform(scrollY, [0, 700], [0, -90]);
    const heroFade = useTransform(scrollY, [0, 700], [1, 0.35]);

    function handleSignup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // no mailing list: the box hands the address to sign-up, which is where an account is made
        const state: AuthHandoff = { email: email.trim(), mode: 'register' };
        navigate('/signin', { state });
    }

    return (
        <MotionConfig reducedMotion="user">
            <div className="landing">
                <LiquidBackdrop intensity="full" />
                <motion.div className="landing-progress" style={{ scaleX: progress }} aria-hidden="true" />

                <header className="landing-nav ui-glass">
                    <div className="landing-nav__inner">
                        <a className="landing-nav__brand" href="#top">
                            <BrandMark size="sm" />
                            <Wordmark />
                        </a>
                        <nav aria-label="Sections" className="landing-nav__links" onPointerLeave={() => setHovered(null)}>
                            {NAV.map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className="landing-nav__link"
                                    aria-current={active === item.id ? 'true' : undefined}
                                    onPointerEnter={() => setHovered(item.id)}
                                >
                                    {item.label}
                                    {indicatorOn === item.id && <motion.span layoutId="landing-nav-indicator" className="landing-nav__indicator" />}
                                </a>
                            ))}
                            <Link to="/signin" className="landing-nav__link">
                                Sign in
                            </Link>
                        </nav>
                        <div className="landing-nav__actions">
                            <ThemeToggle />
                            <Link to="/signin" state={{ mode: 'register' } satisfies AuthHandoff} className="landing-btn landing-btn--solid">
                                Get started
                            </Link>
                        </div>
                    </div>
                </header>

                <main id="top">
                    <motion.section className="landing-hero" aria-labelledby="hero-title" style={{ y: heroY, opacity: heroFade }}>
                        <TiltCard>
                            {/* the logo, in 3D: turns on its own, follows the cursor, spins when clicked */}
                            <div className="landing-hero__mark">
                                <BrandMark size="lg" interactive />
                            </div>
                            <p className="landing-eyebrow">For teams who ship software</p>
                            <h1 id="hero-title" className="landing-hero__title">
                                Catch the bug that never throws.
                            </h1>
                            <p className="landing-hero__subtitle">
                                A VPN eating localhost. A lockfile that drifted. A migration one laptop never ran. IncidentIOQ puts the whole team in one live war room to find
                                it, and flags the teammate who knows that code.
                            </p>
                            <div className="landing-hero__actions">
                                <Link to="/signin" state={{ mode: 'register' } satisfies AuthHandoff} className="landing-btn landing-btn--solid">
                                    Open a war room
                                </Link>
                                <a href="#how" className="landing-btn landing-btn--glass">
                                    See how it works
                                </a>
                            </div>
                        </TiltCard>

                        <motion.dl
                            className="landing-stats ui-glass"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.25, ease: [0.2, 0, 0, 1] }}
                        >
                            {STATS.map((s) => (
                                <div key={s.value + s.label} className="landing-stats__item">
                                    <dt className="landing-stats__label">{s.label}</dt>
                                    <dd className="landing-stats__value">{s.value}</dd>
                                </div>
                            ))}
                        </motion.dl>
                    </motion.section>

                    <Reveal id="features" className="landing-section">
                        <h2 className="landing-section__title">Built for the failures nobody logs</h2>
                        <div className="landing-grid landing-grid--3">
                            {FEATURES.map((f, i) => (
                                <motion.article
                                    key={f.title}
                                    className="landing-card ui-glass"
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false, amount: 0.3 }}
                                    transition={{ duration: 0.5, delay: i * 0.08 }}
                                    whileHover={{ y: -4 }}
                                >
                                    <svg className="landing-card__icon" viewBox="0 0 24 24" aria-hidden="true">
                                        {f.icon}
                                    </svg>
                                    <h3 className="landing-card__title">{f.title}</h3>
                                    <p className="landing-card__body">{f.body}</p>
                                </motion.article>
                            ))}
                        </div>
                    </Reveal>

                    <Reveal id="how" className="landing-section">
                        <h2 className="landing-section__title">How it works</h2>
                        <ol className="landing-steps">
                            {STEPS.map((step, i) => (
                                <li key={step.title} className="landing-step ui-glass">
                                    <span className="landing-step__number" aria-hidden="true">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <h3 className="landing-step__title">
                                            {step.title}
                                            {step.status && <span className="landing-tag">{step.status}</span>}
                                        </h3>
                                        <p className="landing-step__body">{step.body}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </Reveal>

                    <Reveal id="teams" className="landing-section">
                        <h2 className="landing-section__title">From one laptop to three hundred</h2>
                        <p className="landing-section__note">Illustrative scenarios, not customer quotes.</p>
                        <div className="landing-grid landing-grid--2">
                            {VOICES.map((v) => (
                                <figure key={v.who} className="landing-voice ui-glass">
                                    <blockquote className="landing-voice__quote">{v.quote}</blockquote>
                                    <figcaption className="landing-voice__who">
                                        <span className="landing-voice__avatar" aria-hidden="true">
                                            {v.who.charAt(0)}
                                        </span>
                                        {v.who}
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </Reveal>

                    <Reveal id="start" className="landing-section">
                        <div className="landing-cta ui-glass">
                            <h2 className="landing-cta__title">Your next silent failure is already on someone's laptop.</h2>
                            <p className="landing-cta__body">Make an account and open your first war room in under a minute.</p>
                            <form className="landing-cta__form" onSubmit={handleSignup}>
                                <label className="ui-sr-only" htmlFor="landing-email">
                                    Email
                                </label>
                                <input
                                    id="landing-email"
                                    className="landing-cta__input"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <button type="submit" className="landing-btn landing-btn--solid">
                                    Create account
                                </button>
                            </form>
                        </div>
                    </Reveal>
                </main>

                <footer className="landing-footer ui-glass">
                    <div className="landing-footer__inner">
                        <span className="landing-footer__brand brand">
                            <BrandMark size="sm" />
                            <Wordmark />
                        </span>
                        <nav aria-label="Footer" className="landing-footer__links">
                            {NAV.map((n) => (
                                <a key={n.id} href={`#${n.id}`}>
                                    {n.label}
                                </a>
                            ))}
                            <Link to="/signin">Sign in</Link>
                        </nav>
                        <small className="landing-footer__copy">© 2026 IncidentIOQ · Built by Manny and Anthony</small>
                    </div>
                </footer>
            </div>
        </MotionConfig>
    );
}
