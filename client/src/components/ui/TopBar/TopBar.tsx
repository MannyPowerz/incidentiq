import { useLayoutEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './TopBar.css';

export type TopBarLink = { to: string; label: string };

type TopBarProps = {
    links: TopBarLink[];
    // presence, sign-out, anything that belongs on the right edge
    right?: ReactNode;
    brandTo?: string;
};

/**
 * TopBar — the app's one persistent floating layer, so it is the one glass surface on every
 * authenticated screen. The active-tab indicator is a single element that slides between links
 * (measured, not re-rendered per link) so a route change reads as motion rather than a swap.
 */
export default function TopBar({ links, right, brandTo = '/rooms' }: TopBarProps): JSX.Element {
    const navRef = useRef<HTMLElement>(null);
    const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
    const { pathname } = useLocation();

    // measure the active link after layout so the indicator's width matches the label it sits under
    useLayoutEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
        if (!active) {
            setIndicator(null);
            return;
        }
        setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    }, [pathname, links]);

    return (
        <header className="ui-topbar ui-glass">
            <div className="ui-topbar__inner">
                <NavLink to={brandTo} className="ui-topbar__brand" aria-label="IncidentIQ home">
                    <span className="ui-topbar__mark" aria-hidden="true" />
                    <span className="ui-topbar__name">IncidentIQ</span>
                </NavLink>

                <nav ref={navRef} className="ui-topbar__nav" aria-label="Primary">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `ui-topbar__link${isActive ? ' ui-topbar__link--active' : ''}`}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    {indicator && (
                        <span
                            className="ui-topbar__indicator"
                            aria-hidden="true"
                            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
                        />
                    )}
                </nav>

                {right && <div className="ui-topbar__right">{right}</div>}
            </div>
        </header>
    );
}
