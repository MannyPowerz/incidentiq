import type { JSX } from "react";
import "./RoomsFooter.css"

type RoomsFooterProps = {
    visibleRooms: number
    totalRooms: number
}

export default function RoomsFooter ({ visibleRooms, totalRooms, }: RoomsFooterProps) : JSX.Element {
    return (
        <footer className="rooms-footer">
            <p className="rooms-footer-summary">
                Showing 1 to {visibleRooms} of {totalRooms} rooms
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