import type { TimelineEvent } from "../types/timelineEvent";

export const timelineEvents: TimelineEvent[] = [
    {
        id: 1,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:16:00"),
        title: "Incident room created",
        description: "The incident was detected and a room was created.",
        author: "System",
    },
    {
        id: 2,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:31:00"),
        title: "Investigation started",
        description: "The assigned engineer began investigating the issue.",
        author: "Anthony",
    },
    {
        id: 3,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:48:00"),
        title: "Service impact confirmed",
        description: "The affected service was confirmed to be experiencing failures.",
        author: "Anthony",
    },
];