/**
 * HeroGate — decides between the 3D hero and the CSS shape, and makes the CSS shape the answer to
 * every failure. The 3D chunk is only requested when all three hold: a desktop-wide screen (the
 * hero is hidden below 1024px anyway), no reduced-motion preference, and a working WebGL context.
 */

import { Component, Suspense, lazy, useSyncExternalStore } from 'react';
import type { JSX, ReactNode } from 'react';

const Hero3D = lazy(() => import('./Hero3D'));

const DESKTOP = '(min-width: 1024px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
    );
}

// some browsers, VMs and locked-down machines have no WebGL; asking once is cheaper than failing inside three.js
export function webglAvailable(): boolean {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
        return false;
    }
}

// a context that is lost or refused after loading still lands on the CSS shape, never on a broken sign-in page
class HeroBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

export default function HeroGate({ fallback, webgl = webglAvailable }: { fallback: ReactNode; webgl?: () => boolean }): JSX.Element {
    const desktop = useMediaQuery(DESKTOP);
    const reducedMotion = useMediaQuery(REDUCED_MOTION);

    if (!desktop || reducedMotion || !webgl()) return <>{fallback}</>;

    return (
        <HeroBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
                <Hero3D />
            </Suspense>
        </HeroBoundary>
    );
}
