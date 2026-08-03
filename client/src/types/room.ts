export type RoomSeverity = "Critical" | "High" | "Medium" | "Low"
export type RoomsStatus = "Open" | "Investigating" | "Resolved"

export type Room = {
    id: string;
    title: string;
    description: string;
    severity: RoomSeverity;
    status: RoomsStatus;
    assignee: string;
    updatedAt: Date;
}

export type NewRoom = {
    title: string;
    description: string;
    severity: RoomSeverity;
    assignee: string;
}