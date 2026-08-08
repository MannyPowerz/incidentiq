import type { JSX } from "react";
import type { RoomsStatus } from "../../types/room";
import "./StatusBadge.css"

type StatusBadgeProps = {
    status: RoomsStatus
}

export default function StatusBadge ({ status, } : StatusBadgeProps ) : JSX.Element {
    return (
        <span className={`status-badge status-badge-${status.toLocaleLowerCase()}`}>
            {status}
        </span>
    )
}