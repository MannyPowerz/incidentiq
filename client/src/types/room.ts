export type RoomSeverity = "P1" | "P2" | "P3" | "P4"

export type RoomsStatus = 
    | "detected"
    | "investigating"
    | "mitigated"
    | "resolved"
    | "postmortem"

export type Room = {
    id: string;
    title: string;
    description: string;
    severity: RoomSeverity;
    status: RoomsStatus;
    assignee: string;
    createdAt: Date;
    updatedAt: Date;
}

export type NewRoom = {
    title: string;
    description: string;
    severity: RoomSeverity;
    assignee: string;
}