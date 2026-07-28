import type { JSX } from "react";
import "./RoomsPage.css"
import RoomsHeader from "../components/rooms/RoomsHeader";

export default function RoomsPage () : JSX.Element {
    return (
        <main className="rooms-page">
            <RoomsHeader />
        </main>
    )
}