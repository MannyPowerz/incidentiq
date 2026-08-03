import type { JSX } from "react";
import { useState } from "react";
import type { NewRoom } from "../../types/room";
import CreateRoomModal from "./CreateRoomModal";
import "./RoomsHeader.css"

type RoomsHeaderProps = {
    onCreateRoom: (room: NewRoom) => void
}

export default function RoomsHeader ({ onCreateRoom} : RoomsHeaderProps) : JSX.Element {

    const [ isModalOpen, setIsModalOpen ] = useState<boolean>(false);

    function handleOpenModal() : void {
        setIsModalOpen(true)
    }

    function handleCloseModal() : void {
        setIsModalOpen(false)
    }

    return (
        <>
            <header className="rooms-header">
                <div className="rooms-header-text">
                    <h1 className="rooms-header-title">Rooms</h1>
                    <p className="rooms-header-description">
                        Monitor rooms, review incidents, and track their status
                    </p>
                </div>

                <button 
                    type="button" 
                    className="rooms-header-button"
                    onClick={handleOpenModal}
                >
                    + Create Room
                </button>
            </header>

            <CreateRoomModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onCreateRoom={onCreateRoom}
            />
        </>
    )
}