import type { JSX } from "react";
import { useState } from "react";
import type { NewRoom, RoomSeverity } from "../../types/room";
import "./CreateRoomModal.css"


type CreateRoomModalProps = {
    isOpen: boolean
    onClose: () => void
    onCreateRoom: (room: NewRoom) => void
}

export default function CreateRoomModal ({ 
    isOpen, 
    onClose,
    onCreateRoom
} : CreateRoomModalProps) : JSX.Element | null {

    const [ title, setTitle ] = useState<string>("")

    const [ description, setDescription ] = useState<string>("")

    const [ severity, setSeverity ] = useState<RoomSeverity>("Medium")

    const [ assignee, setAssignee ] = useState<string>("")

    function resetForm() : void {
        setTitle("")
        setDescription("")
        setSeverity("Medium")
        setAssignee("")
    }

    function handleClose() : void {
        resetForm()
        onClose()
    }

    function handleCreateRoom() : void {
        const trimmedTitle = title.trim()
        const trimmedDescription = description.trim()
        const trimmedAssignee = assignee.trim()

        if ( trimmedTitle === "" || trimmedDescription === "" || trimmedAssignee === "" ) {
            return
        }

        onCreateRoom({
            title: trimmedTitle,
            description: trimmedDescription,
            severity,
            assignee: trimmedAssignee
        })

        resetForm()
        onClose()
    }

    if (!isOpen) {
        return null
    }

    return (
        <div className="create-room-modal-overlay">
            <div 
                className="create-room-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-room-title"
            >
                <header className="create-room-modal-header">
                    
                    <h2 id="create-room-title">Create Room</h2>

                    <button
                        type="button"
                        className="create-room-modal-close"
                        onClick={handleClose}
                        aria-label="Close modal"
                    >
                        X
                    </button>
                </header>

                <div className="create-room-modal-body">
                    <label className="create-room-field">
                        <span>Room Title</span>
                        <input 
                            type="text" 
                            placeholder="Enter room title" 
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>

                    <label className="create-room-field">
                        <span>Description</span>
                        <textarea
                            className="create-room-description"
                            placeholder="Describe the incident..."
                            rows={4}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </label>

                    <label className="create-room-field">
                        <span>Severity</span>
                        <select
                            value={severity}
                            onChange={(event) => setSeverity(event.target.value as RoomSeverity)}
                        >
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </label>

                    <label className="create-room-field">
                        <span>Assignee</span>
                        <input 
                            type="text" 
                            placeholder="Assign a user" 
                            value={assignee}
                            onChange={(event) => setAssignee(event.target.value)}    
                        />
                    </label>
                </div>

                <footer className="create-room-modal-footer">
                    <button
                        type="button"
                        className="create-room-cancel-button"
                        onClick={handleClose}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="create-room-submit-button"
                        onClick={handleCreateRoom}
                        disabled={title.trim() === "" ||
                                  description.trim() === "" ||
                                  assignee.trim() === ""
                                 }
                    >
                        Create Room
                    </button>
                </footer>

            </div>
        </div>
    )
}