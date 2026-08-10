import type { TimelineEvent } from "../types/timelineEvent";

export const timelineEvents: TimelineEvent[] = [
    {
        id: 1,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:16:00"),
        title: "Incident created",
        description: "Automatically created from local agent detection.",
        author: "System",
        type: "created",
    },
    {
        id: 2,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:21:00"),
        title: "Anthony joined the room",
        description: "Joined as the assigned incident responder.",
        author: "System",
        type: "joined",
    },
    {
        id: 3,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:28:00"),
        title: "Repeated failures detected",
        description: "The local agent detected repeated service failures.",
        author: "System",
        type: "detection",
    },
    {
        id: 4,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:34:00"),
        title: "Traffic rerouted",
        description: "Traffic is being rerouted while the issue is investigated.",
        author: "Anthony",
        type: "update",
    },
    {
        id: 5,
        roomId: "ROOM-0001",
        createdAt: new Date("2026-07-29T18:41:00"),
        title: "Service logs added",
        description: "Relevant service logs were added as evidence.",
        author: "Anthony",
        type: "evidence",
    },
];