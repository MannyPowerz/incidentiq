import type { JSX } from "react";
import "./RoomsPage.css"
import RoomsHeader from "../components/rooms/RoomsHeader";
import RoomsFilters from "../components/rooms/RoomsFilters";
import RoomsCard from "../components/rooms/RoomsCard";
import { rooms } from "../data/rooms";
import RoomsTable from "../components/rooms/RoomsTable";
import RoomsFooter from "../components/rooms/RoomsFooter";

export default function RoomsPage () : JSX.Element {
    return (
        <main className="rooms-page">
            <RoomsHeader />
            <RoomsCard>
                <RoomsFilters />
                <RoomsTable rooms={rooms} />
                <RoomsFooter />
            </RoomsCard>
        </main>
    )
}