import type { TimelineEvent } from "../types/timelineEvent";

export const timelineEvents: TimelineEvent [] = [
    {
        id: 1,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:16:00"),
        title: "Incident created",
        description: "Incident room was created.",
        author: "System",
        type: "system",
    },
    {
        id: 2,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:21:00"),
        title: "Anthony joined the room",
        description: "Joined as the assigned incident responder.",
        author: "System",
        type: "system",
    },
    {
        id: 3,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:28:00"),
        title: "Repeated failures observed",
        description: "Repeated service failures were observed during the investigation.",
        author: "Anthony",
        type: "observation",
    },
    {
        id: 4,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:34:00"),
        title: "Traffic rerouted",
        description: "Traffic was rerouted while the issue was investigated.",
        author: "Anthony",
        type: "action",
    },
    {
        id: 5,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:41:00"),
        title: "Service logs reviewed",
        description: "Service logs showed repeated failures during the affected period.",
        author: "Anthony",
        type: "finding",
    },
];