import {z} from 'zod'
import { aiDraftRequestSchema } from "../types.js";
import { validateBody, requireAuth } from "../../auth/middleware.js";
import { Router } from "express";

//This replicates the the body a client can post; however incidentId is not here due to it being present in the mount path
//incidentId -> true since this is the field that key req.params already provides
const postAiDraftSchema = aiDraftRequestSchema.omit({incidentId: true})
export type postAiDraft = z.infer<typeof postAiDraftSchema >

//mergeParams -> true: similarily in timeline/routes/index.ts, incidents.id is captured in the mounted POST request.
//setting it to false will persist the router into handling an undefined incidents id
export const aiDraftRouter = Router({mergeParams: true})

aiDraftRouter.post('/', requireAuth, validateBody(postAiDraftSchema))

