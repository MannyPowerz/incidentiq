import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import RoomHeader from "../components/roomDetails/RoomHeader";
import RoomOverview from "../components/roomDetails/tabs/RoomOverview";
import RoomTabs, { type RoomTab } from "../components/roomDetails/RoomTabs";
import RoomTimeline from "../components/roomDetails/tabs/RoomTimeline";
import RoomAIAnalysis from "../components/roomDetails/tabs/RoomAIAnalysis";
import { aiAnalyses } from "../data/aiAnalysis";
import { rooms } from "../data/rooms";
import type { JSX } from "react";
import "./RoomDetailsPage.css"

export default function RoomDetailsPage () : JSX.Element {

    const { roomId } = useParams<{ roomId: string}>()

    const [ activeTab, setActiveTab ] = useState<RoomTab>("Overview");

    const room = rooms.find((currentRoom) => currentRoom.id === roomId)

    const navigate = useNavigate()

    if (!room) {
        return (
            <div className="room-details-layout">
                <DashboardSidebar activePage="Rooms" />

                <main className="room-details-page">
                    <section className="room-not-found">
                        <h1 className="room-not-found-title">Room not found</h1>
                        <p className="room-not-found-message">
                            The room you are looking for does not exist or may have been removed
                        </p>
                        <button
                            className="room-not-found-button"
                            type="button"
                            onClick={() => navigate("/rooms")}
                        >
                            Back to Rooms
                        </button>
                    </section>
                </main>
            </div>
        )
    }

    const aiAnalysis = aiAnalyses.find((analysis) => analysis.roomId === room.id)

    return (
        <div className="room-details-layout">
            <DashboardSidebar activePage="Rooms"/>
            
            <main className="room-details-page">
                <RoomHeader room={room} />
                <RoomTabs 
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                {activeTab === "Overview" && (
                    <RoomOverview room={room} />
                )}

                {activeTab === "Timeline" && (
                    <RoomTimeline room={room} />
                )}

                {activeTab === "AI Analysis" && aiAnalysis && (
                    <RoomAIAnalysis analysis={aiAnalysis} />
                )}
            </main>
        </div>
    )
}