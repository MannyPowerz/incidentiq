import { useState } from "react";
import type { JSX } from "react";
import "./RoomActions.css"

export default function RoomActions() : JSX.Element {

    const [ isOpen, setIsOpen ] = useState<boolean>(false)

    function handleToggle() : void {
        setIsOpen((currentValue) => !currentValue)
    }

    return (
        <div className="room-actions">
            <button
                type="button"
                className="room-actions-button"
                aria-label="Open room actions"
                aria-expanded={isOpen}
                onClick={handleToggle}
            >
                ⋮
            </button>

            {isOpen && (
                <div className="room-actions-menu">
                    <button type="button" className="room-actions-menu-item">
                        View Room
                    </button>
                    <button type="button" className="room-actions-menu-item">
                        Edit Room
                    </button>
                    <button type="button" className="room-actions-menu-item">
                        Resolve Room
                    </button>
                </div>
            )}
        </div>
    )
}