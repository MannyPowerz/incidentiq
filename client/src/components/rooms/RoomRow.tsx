import type { JSX } from "react";
import type { Room } from "../../types/room";
import SeverityBadge from "./SeverityBadge";
import StatusBadge from "./StatusBadge";
import RoomActions from "./RoomActions";
import { formatRelativeTime } from "../../utils/formatRelativeTime";

type RoomRowProps = {
    room: Room
    onEditRoom: (room: Room) => void
    onResolveRoom: (roomId: string) => void
}

export default function RoomRow ({ room, onEditRoom, onResolveRoom }: RoomRowProps ) : JSX.Element {
    return (
        <div className="rooms-table-row">
            <span className="rooms-table-id">{room.id}</span>
            <span className="rooms-table-title">{room.title}</span>
            <SeverityBadge severity={room.severity} />
            <StatusBadge status={room.status} />
            <span>{room.assignee}</span>
            <span className="rooms-table-updated">{formatRelativeTime(room.updatedAt)}</span>
            <RoomActions 
                room={room}
                onEditRoom={onEditRoom}
                onResolveRoom={onResolveRoom}
            />
        </div>
    )
}