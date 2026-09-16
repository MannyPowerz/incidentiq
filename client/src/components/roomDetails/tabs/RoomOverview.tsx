import type { JSX } from "react";
import type { Room } from "../../../types/room";
import { formatDateTime } from "../../../utils/formatDateTime";
import "./RoomOverview.css"

type RoomOverviewProps = {
    room: Room
}

export default function RoomOverview ({ room } : RoomOverviewProps ) : JSX.Element {
    return (
        <section
            className="room-overview"
            aria-labelledby="room-overview-title"
        >
            <h2 id="room-overview-title" className="sr-only">
                Room overview
            </h2>

            <div className="room-overview-panel">
                <div className="room-overview-main">
                    <article className="room-overview-section">

                        <h3 className="room-overview-card-title">
                            Description
                        </h3>

                        <p className="room-overview-description">{room.description}</p>
                    </article>

                    <article className="room-overview-section room-overview-status-section">
                        <h3 className="room-overview-card-title">Current Status</h3>
                        <p className="room-overview-status-text">
                            {room.status === "Resolved"
                            ? "This room has been resolved"
                            : room.status === "Investigating"
                                ? "The team is actively investigating this issue"
                                : "This room is currently open and waiting for investigation"}
                        </p>
                    </article>
                </div>

                <aside className="room-overview-details-card">
                    <h3 className="room-overview-card-title">Room Details</h3>
                    <dl className="room-overview-details-list">

                        <div className="room-overview-details-row">
                            <dt>Created</dt>
                            <dd>{formatDateTime(room.createdAt)}</dd>
                        </div>
                        
                        <div className="room-overview-details-row">
                            <dt>Last Updated</dt>
                            <dd>{formatDateTime(room.updatedAt)}</dd>
                        </div>

                        <div className="room-overview-details-row">
                            <dt>Priority</dt>
                            <dd>{room.severity}</dd>
                        </div>

                        <div className="room-overview-details-row">
                            <dt>Reported By</dt>
                            <dd>Someone</dd>
                        </div>

                        <div className="room-overview-details-row">
                            <dt>Room Type</dt>
                            <dd>Incident</dd>
                        </div>

                    </dl>

                    <button 
                        className="room-overview-resolve-button"
                        type="button"
                        disabled={room.status === "Resolved"}
                    >
                        {room.status === "Resolved" ? "Room Resolved" : "Resolve Room"}
                    </button>
                    
                </aside>
            </div>
        </section>
    )
}