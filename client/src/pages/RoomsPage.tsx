import { useMemo, useState, useEffect } from "react"
import { rooms } from "../data/rooms"
import type { JSX } from "react"
import type { SortOption } from "../components/rooms/RoomsFilters"
import type { RoomSeverity, RoomsStatus } from "../types/room"
import DashboardSidebar from "../components/dashboard/DashboardSidebar"
import RoomsCard from "../components/rooms/RoomsCard"
import RoomsFilters from "../components/rooms/RoomsFilters"
import RoomsFooter from "../components/rooms/RoomsFooter"
import RoomsHeader from "../components/rooms/RoomsHeader"
import RoomsTable from "../components/rooms/RoomsTable"
import RoomsEmptyState from "../components/rooms/RoomsEmptyState"
import "./RoomsPage.css"


export default function RoomsPage () : JSX.Element {

    const [ searchTerm, setSearchTerm ] = useState<string>("")

    const [ statusFilter, setStatusFilter ] = useState<"All" | RoomsStatus>("All")

    const [ severityFilter, setSeverityFilter ] = useState<"All" | RoomSeverity>("All")

    const [ sortOption, setSortOption ] = useState<SortOption>("Newest First")

    const [ currentPage, setCurrentPage ] = useState<number>(1)

    const roomsPerPage = 6

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

    const totalPages = Math.ceil(
        filteredRooms.length / roomsPerPage
    )

    const paginatedRooms = useMemo( () => {
        const firstRoomIndex = (currentPage - 1) * roomsPerPage
        const lastRoomIndex = firstRoomIndex + roomsPerPage

        return filteredRooms.slice(firstRoomIndex, lastRoomIndex)
    }, [ filteredRooms, currentPage])

    useEffect( () => {
        setCurrentPage(1)
    }, [ searchTerm, statusFilter, severityFilter, sortOption ])

    const startIndex = filteredRooms.length === 0 ? 0 : (currentPage - 1) * roomsPerPage + 1

    const endIndex = Math.min(currentPage * roomsPerPage, filteredRooms.length,)

    return (

        <div className="rooms-layout">
            <DashboardSidebar activePage="Rooms"/>
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
                    
                    {filteredRooms.length > 0 ? (
                        <RoomsTable rooms={paginatedRooms} />
                    ) : (
                        <RoomsEmptyState />
                    )}

                    <RoomsFooter 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        totalRooms={filteredRooms.length}
                        onPageChange={setCurrentPage}
                    />
                </RoomsCard>
            </main>
        </div>
    )
}