import type { JSX } from "react";
import "./RoomsEmptyState.css"

export default function RoomsEmptyState () : JSX.Element {
    return (
        <section className="rooms-empty-state">
            <div className="rooms-empty-state-icon">⌕</div>
            <h2 className="rooms-empty-state-title">No rooms found</h2>
            <p className="rooms-empty-state-description">
                Try adjusting your search or filters
            </p>
        </section>
    )
}