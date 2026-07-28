import type { JSX } from "react";
import "./RoomsFilters.css"

export default function RoomsFilters () : JSX.Element {
    return (
        <section className="rooms-filters">
            <input
                type="text"
                placeholder="Search rooms..."
                className="rooms-search-input"
            />

            <select className="rooms-filter-select">
                <option>Status</option>
            </select>

            <select className="rooms-filter-select">
                <option>Severity</option>
            </select>

            <select className="rooms-filter-select">
                <option>Sort By</option>
            </select>
        </section>
    )
}