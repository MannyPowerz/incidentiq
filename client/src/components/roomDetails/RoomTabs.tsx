import type { JSX } from "react";
import "./RoomTabs.css"

export type RoomTab =
    | "Overview"
    | "Timeline"
    | "AI Analysis"
    | "Related Incidents"

type RoomTabsProps = {
    activeTab: RoomTab
    onTabChange: (tab: RoomTab) => void
}

const roomTabs: RoomTab [] = [
    "Overview",
    "Timeline",
    "AI Analysis",
    "Related Incidents",
]

export default function RoomTabs ({ activeTab, onTabChange } : RoomTabsProps ) : JSX.Element {
    return (
        <nav
            className="room-tabs"
            aria-label="Incident room sections"
        >
            <div className="room-tabs-list" role="tablist">
                {roomTabs.map((tab) => {
                    const isActive = activeTab === tab

                    return (
                        <button
                            key={tab}
                            id={`room-tab-${tab.toLowerCase().replaceAll(" ", "-")}`}
                            className={`room-tab ${isActive ? "room-tab-active" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onTabChange(tab)}
                        >
                            {tab}
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}