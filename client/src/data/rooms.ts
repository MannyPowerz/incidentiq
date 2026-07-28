import type { Room } from "../types/room";

export const rooms : Room [] = [
    {
        id: "ROOM-0001",
        title: "Problem 1",
        severity: "Critical",
        status: "Open",
        assignee: "Anthony",
        updatedAt: "2 minutes ago",
    },
    {
        id: "ROOM-0002",
        title: "Problem 2",
        severity: "High",
        status: "Investigating",
        assignee: "Manny",
        updatedAt: "18 minutes ago",
    },
    {
        id: "ROOM-0003",
        title: "Problem 3",
        severity: "Medium",
        status: "Resolved",
        assignee: "Gabby",
        updatedAt: "42 minutes ago",
    },
    {
        id: "ROOM-0004",
        title: "Problem 4",
        severity: "Low",
        status: "Open",
        assignee: "Sarah",
        updatedAt: "3 hours ago",
    },
]