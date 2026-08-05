import type { JSX } from "react";
import type { RoomSeverity } from "../../types/room";
import "./SeverityBadge.css"

type SeverityBadgeProps = {
    severity: RoomSeverity
}

export default function SeverityBadge({ severity, } : SeverityBadgeProps ) : JSX.Element {
    return (
        <span className={`severity-badge severity-badge-${severity.toLocaleLowerCase()}`}>
            {severity}
        </span>
    )
}