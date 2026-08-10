export type TimelineEvent = {
    id: number
    roomId: string
    createdAt: Date
    title: string
    description: string
    author: string
    type: "created" | "joined" | "detection" | "update" | "evidence"
}

export type ManualTimelineEventTypes = 
    | "detection"
    | "update"
    | "evidence"