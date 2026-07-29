import type { JSX } from "react";
import type { Room } from "../../types/room";
import SeverityBadge from "./SeverityBadge";
import StatusBadge from "./StatusBadge";
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
            </div>

            <div className="rooms-table-body">
                {rooms.map((room) => (
                    <div className="rooms-table-row" key={room.id}>
                        <span className="rooms-table-id">{room.id}</span>
                        <span className="rooms-table-title">{room.title}</span>
                        <SeverityBadge severity={room.severity} />
                        <StatusBadge status={room.status} />
                        <span>{room.assignee}</span>
                        <span className="rooms-table-updated">{room.updatedAt}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}