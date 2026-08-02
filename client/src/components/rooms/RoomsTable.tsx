import type { JSX } from "react";
import type { Room } from "../../types/room";
import RoomRow from "./RoomRow";
import "./RoomsTable.css"

type RoomsTableProps = {
    rooms: Room[]
}

export default function RoomsTable({ rooms, } : RoomsTableProps) : JSX.Element {
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
                    <RoomRow key={room.id} room={room} />
                ))}
            </div>
        </div>
    )
}