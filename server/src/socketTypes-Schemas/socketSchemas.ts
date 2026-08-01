import {z} from 'zod'
import type { ClientToServer } from './socketTypes.js'

//This schema emmits a number identically the incidentId
const joinRoomSchema = z.number();

const SendingMessageSchema = z.object({
    incidentId: z.number(),
    type: z.enum(['observation', 'action', 'finding', 'system', 'ai_draft']),
    body: z.object({
        summary: z.string(),
        why_it_matters: z.string(),
        likely_fix: z.string()
    })
})

//names one validater per inbound event, making a type error if forgetting one
export const socketSchemas: Record<keyof ClientToServer, z.ZodType> = {
    'join-room': joinRoomSchema,
    'sending-message': SendingMessageSchema
}