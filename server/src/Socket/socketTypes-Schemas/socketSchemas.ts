import {z} from 'zod'
import type { ClientToServer } from './socketTypes.js'

//This schema emmits a number identically the incidentId
const joinRoomSchema = z.object({
    //to represent literal DB id
    incidentId: z.number().int().positive(),
    //sinceId is either a number equavialent to a timeline_entries id or undefined. This is determined if socket joines normally or joines upon disconection
    sinceId: z.number().int().positive().optional()
})

const SendingMessageSchema = z.object({
    incident_id: z.number(),
    type: z.enum(['observation', 'action', 'finding']),//same closed set as postTimelineEntrySchema
    body: z.object({
        summary: z.string(),
        why_it_matters: z.string(),
        likely_fix: z.string()
    })
})

//While validateSocketData already safe parses every inbound payload against this exact schema and rejects mismatches making it a runtime truth for 'sending-message'
//Deriving the type validates the compile-time agreeing with the runtime by construction
export type ValidatingMessage = z.infer<typeof SendingMessageSchema>
export type ValidatingJoining = z.infer<typeof joinRoomSchema>

//names one validater per inbound event, making a type error if forgetting one
export const socketSchemas: Record<keyof ClientToServer, z.ZodType> = {
    'join-room': joinRoomSchema,
    'sending-message': SendingMessageSchema
}