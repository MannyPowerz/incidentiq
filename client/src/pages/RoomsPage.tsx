import type { JSX } from "react";
import "./RoomsPage.css"
import RoomsHeader from "../components/rooms/RoomsHeader";
import RoomsFilters from "../components/rooms/RoomsFilters";
import RoomsCard from "../components/rooms/RoomsCard";

export default function RoomsPage () : JSX.Element {
    return (
        <main className="rooms-page">
            <RoomsHeader />
            <RoomsCard>
                <RoomsFilters />
            </RoomsCard>
        </main>
    )
}