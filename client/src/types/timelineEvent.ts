export type TimelineEventType =
    | "observation"
    | "action"
    | "finding"
    | "system"
    | "ai_draft"

export type ManualTimelineEventType =
    | "observation"
    | "action"
    | "finding"

export type TimelineEvent = {
    id: number
    roomId: string
    createdAt: Date
    title: string
    description: string
    author: string
    type: TimelineEventType
}