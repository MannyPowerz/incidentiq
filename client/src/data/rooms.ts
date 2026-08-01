import type { Room } from "../types/room";

export const rooms : Room [] = [
    {
        id: "ROOM-0001",
        title: "Problem 1",
        severity: "Critical",
        status: "Open",
        assignee: "Anthony",
        updatedAt: new Date("2026-07-29T18:16:00"),
    },
    {
        id: "ROOM-0002",
        title: "Problem 2",
        severity: "High",
        status: "Investigating",
        assignee: "Manny",
        updatedAt: new Date("2026-07-29T18:00:00"),
    },
    {
        id: "ROOM-0003",
        title: "Problem 3",
        severity: "Medium",
        status: "Resolved",
        assignee: "Gabby",
        updatedAt: new Date("2026-07-29T17:36:00"),
    },
    {
        id: "ROOM-0004",
        title: "Problem 4",
        severity: "Low",
        status: "Open",
        assignee: "Sarah",
        updatedAt: new Date("2026-07-29T15:18:00"),
    },
]