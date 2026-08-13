import type { JSX, ChangeEvent } from "react";
import type { RoomSeverity, RoomsStatus } from "../../types/room";
import { Search } from "lucide-react";
import "./RoomsFilters.css"

export type SortOption = "Newest First" | "Oldest First"

type RoomsFiltersProps = {
    searchTerm: string
    statusFilter: "All" | RoomsStatus
    severityFilter: "All" | RoomSeverity
    sortOption: SortOption
    onSearchChange: (value: string) => void
    onStatusChange: (value: "All" | RoomsStatus) => void
    onSeverityChange: (value: "All" | RoomSeverity) => void
    onSortChange: (value: SortOption) => void
}

export default function RoomsFilters ({ 
    searchTerm,
    statusFilter,
    severityFilter,
    sortOption,
    onSearchChange,
    onStatusChange,
    onSeverityChange,
    onSortChange,
} : RoomsFiltersProps) : JSX.Element {

    const handleSearchChange = ( event: ChangeEvent<HTMLInputElement>, ) : void => {
        onSearchChange(event.target.value);
    }

    const handleStatusChange = ( event: ChangeEvent<HTMLSelectElement>, ) : void => {
        onStatusChange(event.target.value as "All" | RoomsStatus)
    }

    const handleSeverityChange = ( event: ChangeEvent<HTMLSelectElement>, ) : void => {
        onSeverityChange(event.target.value as "All" | RoomSeverity)
    }

    const handleSortChange = ( event: ChangeEvent<HTMLSelectElement>, ) : void => {
        onSortChange(event.target.value as SortOption)
    }

    return (
        <section className="rooms-filters">

            <div className="rooms-search">
                <Search size={18} className="rooms-search-icon" />
                <input
                type="search"
                className="rooms-search-input"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={handleSearchChange}
            />
            </div>
                
            <div className="rooms-select-wrapper">
                <select
                    className="rooms-filter-select"
                    value={statusFilter}
                    onChange={handleStatusChange}
                    aria-label="Filter rooms by status"
                >
                    <option value="All">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved</option>
                </select>
            </div>

            <div className="rooms-select-wrapper">
                <select
                    className="rooms-filter-select"
                    value={severityFilter}
                    onChange={handleSeverityChange}
                    aria-label="Filter rooms by severity"
                >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>

            <div className="rooms-select-wrapper">
                <select
                    className="rooms-filter-select"
                    value={sortOption}
                    onChange={handleSortChange}
                    aria-label="Sort Rooms"
                >
                    <option value="Newest First">Newest First</option>
                    <option value="Oldest First">Oldest First</option>
                </select>
            </div>

        </section>
    )
}