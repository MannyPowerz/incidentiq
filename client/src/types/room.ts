export type RoomSeverity = "Critical" | "High" | "Medium" | "Low"
export type RoomsStatus = "Open" | "Investigating" | "Resolved"

export type Room = {
    id: string;
    title: string;
    severity: RoomSeverity;
    status: RoomsStatus;
    assignee: string;
    updatedAt: Date;
}