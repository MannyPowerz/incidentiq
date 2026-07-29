import type { JSX } from "react";
import type { Room } from "../../types/room";
import SeverityBadge from "./SeverityBadge";
import StatusBadge from "./StatusBadge";

type RoomRowProps = {
    room: Room
}

export default function RoomRow ({ room }: RoomRowProps ) : JSX.Element {
    return (
        <div className="rooms-table-row">
            <span className="rooms-table-id">{room.id}</span>
            <span className="rooms-table-title">{room.title}</span>
            <SeverityBadge severity={room.severity} />
            <StatusBadge status={room.status} />
            <span>{room.assignee}</span>
            <span className="rooms-table-updated">{room.updatedAt}</span>
        </div>
    )
}