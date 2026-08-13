import { useMemo, useState, useEffect } from "react"
import { rooms as initialRooms} from "../data/rooms"
import type { JSX } from "react"
import type { SortOption } from "../components/rooms/RoomsFilters"
import type { NewRoom, RoomSeverity, RoomsStatus, Room } from "../types/room"
import DashboardSidebar from "../components/dashboard/DashboardSidebar"
import RoomsCard from "../components/rooms/RoomsCard"
import RoomsFilters from "../components/rooms/RoomsFilters"
import RoomsFooter from "../components/rooms/RoomsFooter"
import RoomsHeader from "../components/rooms/RoomsHeader"
import RoomsTable from "../components/rooms/RoomsTable"
import RoomsEmptyState from "../components/rooms/RoomsEmptyState"
import ViewRoomModal from "../components/rooms/ViewRoomModal"
import "./RoomsPage.css"


export default function RoomsPage () : JSX.Element {

    const [ roomList, setRoomList ] = useState<Room[]>(initialRooms)

    const [ searchTerm, setSearchTerm ] = useState<string>("")

    const [ statusFilter, setStatusFilter ] = useState<"All" | RoomsStatus>("All")

    const [ severityFilter, setSeverityFilter ] = useState<"All" | RoomSeverity>("All")

    const [ sortOption, setSortOption ] = useState<SortOption>("Newest First")

    const [ currentPage, setCurrentPage ] = useState<number>(1)

    const [ roomToEdit, setRoomToEdit ] = useState<Room | null>(null)

    const [ roomToView, setRoomToView ] = useState<Room | null>(null)

    const roomsPerPage = 6

    function handleCreateRooms(newRoomData: NewRoom): void {
        const nextRoomNumber = roomList.reduce((highestNumber, room) => {
            const roomNumber = Number(room.id.replace("ROOM-", ""))

            return Number.isNaN(roomNumber) 
                ? highestNumber
                : Math.max(highestNumber, roomNumber)
        }, 0) + 1

        const createdRoom: Room = {
            id: `ROOM-${String(nextRoomNumber).padStart(4, "0")}`,
            title: newRoomData.title,
            description: newRoomData.description,
            severity: newRoomData.severity,
            status: "Open",
            assignee: newRoomData.assignee,
            updatedAt: new Date()
        }

        setRoomList((currentRooms) => [
            createdRoom,
            ...currentRooms
        ])

        setCurrentPage(1)
    }

    function handleResolveRoom(roomId: string): void {
        setRoomList((currentRooms) => currentRooms.map((room) => 
            room.id === roomId 
            ? {
                ...room,
                status: "Resolved",
                updatedAt: new Date(),
        } : room,),);
    }

    function handleEditRoom(room: Room): void {
        setRoomToEdit(room)
    }

    function handleUpdateRoom(updatedRoom: Room) : void {
        setRoomList((currentRooms) => 
            currentRooms.map((room) => 
                room.id === updatedRoom.id ? updatedRoom : room,
            ),
        );
        setRoomToEdit(null)
    }

    function handleClearEditRoom() : void {
        setRoomToEdit(null)
    }

    function handleViewRoom(room: Room) : void {
        setRoomToView(room)
    }

    function handleCloseViewRoom() : void {
        setRoomToView(null)
    }

    const filteredRooms = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return roomList
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

                return sortOption === "Newest First"
                 ? secondDate - firstDate
                 : firstDate - secondDate
            })
    }, [ searchTerm, statusFilter, severityFilter, sortOption, roomList ])

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
                <RoomsHeader 
                    onCreateRoom={handleCreateRooms} 
                    roomToEdit={roomToEdit}
                    onUpdateRoom={handleUpdateRoom}
                    onClearEditRoom={handleClearEditRoom}
                />
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
                        <RoomsTable 
                            rooms={paginatedRooms} 
                            onEditRoom={handleEditRoom}
                            onResolveRoom={handleResolveRoom}
                            onViewRoom={handleViewRoom}
                        />
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
            <ViewRoomModal
                room={roomToView}
                onClose={handleCloseViewRoom}
            />
        </div>
    )
}