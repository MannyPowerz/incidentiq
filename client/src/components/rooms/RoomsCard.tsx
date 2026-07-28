import type { ReactNode, JSX } from "react";
import "./RoomsCard.css"

interface RoomsCardProps {
    children: ReactNode;
}

export default function RoomsCard ({ children, } : RoomsCardProps) : JSX.Element {
    return (
        <section className="rooms-card">
            {children}
        </section>
    )
}