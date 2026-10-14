/**
 * Hero3D — the sign-in hero as a real 3D shape: one rounded box, lit, turning slowly and leaning
 * toward the pointer. Loaded lazily (SignInPage), so its three.js weight never reaches a phone, a
 * reduced-motion user, or any page after sign-in. The CSS shape stays as its fallback.
 *
 * RoundedBoxGeometry ships inside `three` (examples/jsm), which is why drei is not a dependency
 * (ui-roadmap.md Item 10).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Mesh } from 'three';
import './Hero3D.css';

// radians; matches the CSS fallback's 8 degrees so the two never feel like different objects
const MAX_TILT = 0.14;
const IDLE_SPIN = 0.25;
// how much of the remaining distance to the pointer tilt is closed each frame
const EASE = 0.06;

type Pointer = { x: number; y: number };

// the brand color comes from tokens.css, so the 3D shape and the CSS one can never drift apart
function brandColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
}

function Shape({ pointer }: { pointer: React.RefObject<Pointer> }): JSX.Element {
    const mesh = useRef<Mesh>(null);
    const geometry = useMemo(() => new RoundedBoxGeometry(1.6, 1.6, 1.6, 6, 0.24), []);
    const color = useMemo(brandColor, []);

    useFrame((_, delta) => {
        const m = mesh.current;
        if (!m) return;
        m.rotation.y += delta * IDLE_SPIN;
        // ease toward the pointer rather than snapping, so the shape feels weighted
        m.rotation.x += (-0.35 - pointer.current.y * MAX_TILT - m.rotation.x) * EASE;
        m.rotation.z += (-0.21 + pointer.current.x * MAX_TILT - m.rotation.z) * EASE;
    });

    return (
        <mesh ref={mesh} geometry={geometry} rotation={[-0.35, 0.6, -0.21]}>
            <meshStandardMaterial color={color} roughness={0.38} metalness={0.08} />
        </mesh>
    );
}

export default function Hero3D(): JSX.Element {
    const pointer = useRef<Pointer>({ x: 0, y: 0 });
    // a hidden tab stops rendering entirely, so the GPU and CPU go idle instead of drawing to nobody
    const [visible, setVisible] = useState(() => !document.hidden);

    useEffect(() => {
        const onVisibility = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    return (
        <div
            className="hero-3d"
            onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                pointer.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
            }}
            onPointerLeave={() => {
                pointer.current = { x: 0, y: 0 };
            }}
        >
            <Canvas
                frameloop={visible ? 'always' : 'never'}
                dpr={[1, 2]}
                camera={{ position: [0, 0, 4.4], fov: 40 }}
                gl={{ antialias: true, alpha: true }}
            >
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 4, 5]} intensity={1.8} />
                <Shape pointer={pointer} />
            </Canvas>
        </div>
    );
}
