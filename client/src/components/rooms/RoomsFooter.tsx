import type { JSX } from "react";
import "./RoomsFooter.css"

export default function RoomsFooter () : JSX.Element {
    return (
        <footer className="rooms-footer">
            <p className="rooms-footer-summary">
                Showing 1 to 6 of 24 rooms
            </p>

            <nav className="rooms-footer-controls" aria-label="Rooms pagination">
                <button type="button" className="rooms-footer-button" disabled>
                Prev
                </button>

                <button
                type="button"
                className="rooms-footer-button rooms-footer-button-active"
                aria-current="page"
                >
                1
                </button>

                <button type="button" className="rooms-footer-button">
                2
                </button>

                <button type="button" className="rooms-footer-button">
                3
                </button>

                <button type="button" className="rooms-footer-button">
                4
                </button>

                <button type="button" className="rooms-footer-button">
                Next
                </button>
            </nav>
        </footer>
    )
}