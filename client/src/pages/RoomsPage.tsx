import { useMemo, useState } from "react"
import { rooms } from "../data/rooms"
import type { JSX } from "react"
import type { SortOption } from "../components/rooms/RoomsFilters"
import type { RoomSeverity, RoomsStatus } from "../types/room"
import RoomsCard from "../components/rooms/RoomsCard"
import RoomsFilters from "../components/rooms/RoomsFilters"
import RoomsFooter from "../components/rooms/RoomsFooter"
import RoomsHeader from "../components/rooms/RoomsHeader"
import RoomsTable from "../components/rooms/RoomsTable"
import "./RoomsPage.css"


export default function RoomsPage () : JSX.Element {

    const [ searchTerm, setSearchTerm ] = useState<string>("")

    const [ statusFilter, setStatusFilter ] = useState<"All" | RoomsStatus>("All")

    const [ severityFilter, setSeverityFilter ] = useState<"All" | RoomSeverity>("All")

    const [ sortOption, setSortOption ] = useState<SortOption>("Newest First")

    const filteredRooms = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return rooms
            .filter((room) => {
                const matchesSearch = normalizedSearch === "" ||
                                      room.id.toLowerCase().includes(normalizedSearch) ||
                                      room.title.toLowerCase().includes(normalizedSearch) ||
                                      room.assignee.toLowerCase().includes(normalizedSearch)

                const matchesStatus = statusFilter === "All" || room.status === statusFilter

                const matchesSeverity = severityFilter === "All" || room.severity === severityFilter

                return matchesSearch && matchesStatus && matchesSeverity
            })

            .sort(( firstRoom, secondRoom) => {
                const firstDate = firstRoom.updatedAt.getTime()
                const secondDate = secondRoom.updatedAt.getTime()

                if ( sortOption === "Newest First") {
                    return secondDate - firstDate
                }

                return firstDate - secondDate
            })
    }, [ searchTerm, statusFilter, severityFilter, sortOption ])

    return (
        <main className="rooms-page">
            <RoomsHeader />
            <RoomsCard>
                <RoomsFilters
                    searchTerm={searchTerm}
                    statusFilter={statusFilter}
                    severityFilter={severityFilter}
                    sortOption={sortOption}
                    onSearchChange={setSearchTerm}
                    onStatusChange={setStatusFilter}
                    onSeverityChange={setSeverityFilter}
                    onSortChange={setSortOption}
                />
                <RoomsTable rooms={filteredRooms} />
                <RoomsFooter 
                    visibleRooms={filteredRooms.length}
                    totalRooms={rooms.length}
                />
            </RoomsCard>
        </main>
    )
}