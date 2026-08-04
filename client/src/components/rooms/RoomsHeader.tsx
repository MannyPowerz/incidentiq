import type { JSX } from "react";
import { useState, useEffect } from "react";
import type { NewRoom , Room } from "../../types/room";
import CreateRoomModal from "./CreateRoomModal";
import "./RoomsHeader.css"

type RoomsHeaderProps = {
    onCreateRoom: (room: NewRoom) => void
    roomToEdit: Room | null
    onUpdateRoom: (room: Room) => void
    onClearEditRoom: () => void
}

export default function RoomsHeader ({ 
    onCreateRoom,
    roomToEdit,
    onUpdateRoom,
    onClearEditRoom,
} : RoomsHeaderProps) : JSX.Element {

    const [ isModalOpen, setIsModalOpen ] = useState<boolean>(false);

    useEffect(() => {
        if (roomToEdit) {
            setIsModalOpen(true)
        }
    }, [ roomToEdit ])

    function handleOpenModal() : void {
        setIsModalOpen(true)
    }

    function handleCloseModal() : void {
        setIsModalOpen(false)
        onClearEditRoom()
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
                roomToEdit={roomToEdit}
                onUpdateRoom={onUpdateRoom}
            />
        </>
    )
}