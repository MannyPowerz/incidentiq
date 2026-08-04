import { useState } from "react";
import type { JSX } from "react";
import type { Room } from "../../types/room";
import "./RoomActions.css"

type RoomActionsProps = {
    room: Room
    onEditRoom: (room: Room) => void
    onResolveRoom: (roomId: string) => void
}

export default function RoomActions({ room, onEditRoom, onResolveRoom } : RoomActionsProps) : JSX.Element {

    const [ isOpen, setIsOpen ] = useState<boolean>(false)

    function handleToggle() : void {
        setIsOpen((currentValue) => !currentValue)
    }

    function handleEdit() : void {
        onEditRoom(room)
        setIsOpen(false)
    }

    function handleResolve() : void {
        onResolveRoom(room.id)
        setIsOpen(false)
    }

    return (
        <div className="room-actions">
            <button
                type="button"
                className="room-actions-button"
                aria-label={`Open actions for ${room.title}`}
                aria-expanded={isOpen}
                onClick={handleToggle}
            >
                ⋮
            </button>

            {isOpen && (
                <div className="room-actions-menu">
                    <button 
                        type="button" 
                        className="room-actions-menu-item" 
                    >
                        View Room
                    </button>
                    <button 
                        type="button" 
                        className="room-actions-menu-item"
                        onClick={handleEdit}
                    >
                        Edit Room
                    </button>
                    <button 
                        type="button" 
                        className="room-actions-menu-item"
                        onClick={handleResolve}
                        disabled={room.status === "Resolved"}
                    >
                        {room.status === "Resolved" ? "Resolved" : "Resolve Room"}
                    </button>
                </div>
            )}
        </div>
    )
}