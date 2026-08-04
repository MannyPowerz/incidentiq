import type { JSX } from "react";
import type { Room } from "../../types/room";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import SeverityBadge from "./SeverityBadge";
import StatusBadge from "./StatusBadge";
import "./ViewRoomModal.css"

type ViewRoomModalProps = {
    room: Room | null
    onClose: () => void
}

export default function ViewRoomModal({ room, onClose } : ViewRoomModalProps ): JSX.Element | null {
    
    if (!room) {
        return null
    }

    return (
        <div className="view-room-modal-overlay">
            <section
                className="view-room-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="view-room-title"
            >
                <header className="view-room-modal-header">
                    <div>
                        <p className="view-room-modal-id">{room.id}</p>\
                        <h2 id="view-room-title">{room.title}</h2>
                    </div>

                    <button
                        type="button"
                        className="view-room-modal-close"
                        onClick={onClose}
                        aria-label="Close room details"
                    >
                        X
                    </button>
                </header>

                <div className="view-room-modal-body">
                    <div className="view-room-modal-badges">
                        <SeverityBadge severity={room.severity} />
                        <StatusBadge status={room.status} />
                    </div>

                    <div className="view-room-modal-section">
                        <h3>Description</h3>
                        <p>{room.description}</p>
                    </div>

                    <div className="view-room-modal-details">
                        <div>
                            <span>Assignee</span>
                            <strong>{room.assignee}</strong>
                        </div>

                        <div>
                            <span>Last updated</span>
                            <strong>{formatRelativeTime(room.updatedAt)}</strong>
                        </div>
                    </div>
                </div>

                <footer className="view-room-modal-footer">
                    <button
                        type="button"
                        className="view-room-modal-button"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </footer>

            </section>
        </div>
    )
}