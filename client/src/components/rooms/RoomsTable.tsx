import type { JSX } from "react";
import type { Room } from "../../types/room";
import RoomRow from "./RoomRow";
import "./RoomsTable.css"

type RoomsTableProps = {
    rooms: Room[]
    onEditRoom: (room: Room) => void
    onResolveRoom: (roomId: string) => void
    onViewRoom: (room: Room) => void
}

export default function RoomsTable({ 
    rooms,
     onEditRoom, 
     onResolveRoom,
     onViewRoom
} : RoomsTableProps) : JSX.Element {
    return (
        <div className="rooms-table">
            <div className="rooms-table-header">
                <span>Room ID</span>
                <span>Title</span>
                <span>Severity</span>
                <span>Status</span>
                <span>Assignee</span>
                <span>Updated</span>
                <span aria-label="Actions"></span>
            </div>

            <div className="rooms-table-body">
                {rooms.map((room) => (
                    <RoomRow 
                        key={room.id} 
                        room={room} 
                        onEditRoom={onEditRoom}
                        onResolveRoom={onResolveRoom}
                        onViewRoom={onViewRoom}
                    />
                ))}
            </div>
        </div>
    )
}