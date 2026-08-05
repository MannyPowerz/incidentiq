import { useParams } from "react-router-dom";
import { useState } from "react";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import RoomHeader from "../components/roomDetails/RoomHeader";
import RoomTabs, { type RoomTab } from "../components/roomDetails/RoomTabs";
import { rooms } from "../data/rooms";
import type { JSX } from "react";
import "./RoomDetailsPage.css"

export default function RoomDetailsPage () : JSX.Element {

    const { roomId } = useParams<{ roomId: string}>()

    const [ activeTab, setActiveTab ] = useState<RoomTab>("Overview");

    const room = rooms.find((currentRoom) => currentRoom.id === roomId)

    if (!room) {
        return (
            <main className="room-details-page">
                <p>Room not found</p>
            </main>
        )
    }

    return (
        <div className="room-details-layout">
            <DashboardSidebar />
            
            <main className="room-details-page">
                <RoomHeader room={room} />
                <RoomTabs 
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </main>
        </div>
    )
}