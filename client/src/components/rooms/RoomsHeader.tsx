import type { JSX } from "react";
import "./RoomsHeader.css"

export default function RoomsHeader () : JSX.Element {
    return (
        <header className="rooms-header">
            <div className="rooms-header-text">
                <h1 className="rooms-header-title">Rooms</h1>
                <p className="rooms-header-description">
                    Monitor rooms, review incidents, and track their status
                </p>
            </div>

            <button type="button" className="rooms-header-button">
                + Create Room
            </button>

        </header>
    )
}