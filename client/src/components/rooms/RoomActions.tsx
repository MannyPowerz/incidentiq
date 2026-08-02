import type { JSX } from "react";
import "./RoomActions.css"

export default function RoomActions() : JSX.Element {
    return (
        <button
            type="button"
            className="room-actions-button"
            aria-label="Open room actions"
        >
            ⋮
        </button>
    )
}