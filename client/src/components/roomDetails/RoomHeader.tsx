import type { JSX } from "react"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { Room } from "../../types/room"
import { formatRelativeTime } from "../../utils/formatRelativeTime"
import SeverityBadge from "../rooms/SeverityBadge"
import StatusBadge from "../rooms/StatusBadge"
import "./RoomHeader.css"

type RoomHeaderProps = {
    room: Room
}

export default function RoomHeader ({ room } : RoomHeaderProps) : JSX.Element {

    const navigate = useNavigate()

    function handleBackToRooms () : void {
        navigate("/rooms");
    }

    return (
        <header className="room-details-header">
            <button
                className="room-details-back-button"
                type="button"
                onClick={handleBackToRooms}
            >
                <ArrowLeft size={14} />
                <span>Back to Rooms</span>
            </button>

            <div className="room-details-title-row">
                <h1 className="room-details-title">
                    <span className="room-details-id">{room.id}</span>
                    <span>{room.title}</span>
                </h1>

                <SeverityBadge severity={room.severity} />
                <StatusBadge status={room.status} />
            </div>

            <div className="room-details-meta">
                <span>Started {formatRelativeTime(room.updatedAt)}</span>
                <span className="room-details-separator" aria-hidden="true">•</span>
                <span>Affected Service: unknown</span>
                <span className="room-details-separator" aria-hidden="true">•</span>
                <span>Assigned to: {room.assignee}</span>
            </div>
        </header>
    )
}