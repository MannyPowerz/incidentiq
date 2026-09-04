/**
 * A full-stack setup with a functioning server to replicate that our HTTP pipline for POSTing our LLM-gnerated response
 * creates a transparent and accurate response tailored to user needs. Additionally, verifying error gaps with any possible schema 
 * failures and unresponsive provider calls
 */

import { beforeEach, vi, describe, it, expect, beforeAll, afterAll} from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

//this mock object cleanly replicates the same functionality of constraining a model response to a given schema and then using that
//runnable object to then invoking it into an output
vi.mock('@langchain/google-genai', () => ({
    ChatGoogleGenerativeAI: class {
        withStructuredOutput() {
            return{invoke: invokeMock}
        }
    }
}))

import express from 'express'
import cookieParser from "cookie-parser";
import request from 'supertest'
import {app, io, server} from '../src/socketServer'
import { incidentRouter } from "../src/incidents/routes";
import { authRouter } from "../src/auth/routes";
import { timelineRouter } from "../src/timeline/routes";
import { aiDraftRouter } from "../src/ai/routes/index";
import type { AddressInfo } from "net";
import {io as ioc, type Socket as ClientSocket} from 'socket.io-client'
import { socketAuth } from "../src/Socket/middleware/socket";
import { socketHandlerFunction } from "../src/Socket/routes/socketHandlerFunctions";
import type { AiDraft } from "../src/ai/types";

let port: number;
const clients: ClientSocket[] = [];

beforeAll(async() => {
    app.use(express.json())
    app.use(cookieParser())
    app.use('/auth', authRouter)
    app.use('/incidents', incidentRouter)
    app.use('/incidents/:id/timeline', timelineRouter)
    app.use('/incidents/:id/ai-draft', aiDraftRouter)

    io.use(socketAuth)
    io.on('connect', (socket) => {socketHandlerFunction(io, socket)})

    await new Promise<void>((resolve) => server.listen(0, resolve))
    port = (server.address() as AddressInfo).port
})

afterAll(() => {
    clients.forEach((c) => c.disconnect())
    io.close()//closes the http server
})

//we are minting a new user along with it's token and including the incident's id
async function mintToken() {
    const credentials = {email: 'Salah@gmail.com', password: 'password1234'}
    const newRegistration = await request(app).post('/auth/register').send(credentials)
    const token = newRegistration.body.accessToken as string
    const newIncident = await request(app).post('/incidents')
    .set({Authorization: `Bearer ${token}`})
    .send({title: 'relegation', severity: 'P1'})
    return {token, auth:{Authorization: `Bearer ${token}`}, incidentId: newIncident.body.incident.id}
}

describe('ai-draft route', () => {
    beforeEach(() => {
        invokeMock.mockReset()
        vi.stubEnv('AI_MODEL_NAME', 'gemini-2.5-flash')
    })

    it('ai can detail and post a draft', async() => {
        const {auth, incidentId} = await mintToken();

        const response = {
            summary: `Salah is the best fùtballer`,
            why_it_matters: 'He is the 3rd top scoere for liverpool',
            likely_fix: 'nothing'
        }

        invokeMock.mockResolvedValue(response)

        const posting = await request(app)
        .post(`/incidents/${incidentId}/ai-draft`)
        .set(auth)
        .send({incidentId: incidentId, context: 'same logged output', kind: 'log'})//disincluded body beacuse 

        expect(posting.status).toBe(200)
        expect(posting.body).toStrictEqual(response)//toStrictEqual would reject a response with an undefined field and should hold the response into the same exactness
    })

    it('throws for missing draft column', async() => {
        const {auth, incidentId} = await mintToken();

        const oneResponse = {
            summary: 'only response from ai'
        }

        invokeMock.mockResolvedValue(oneResponse)

        const posting = await request(app)
        .post(`/incidents/${incidentId}/ai-draft`)
        .set(auth)
        .send({incidentId: incidentId, context: 'same logged output', kind: 'log'})

        expect(posting.status).toBe(400)
        expect(posting.body.error).toMatch('invalid_schema_structure')
    })

    it('throws for a provider call errors', async() => {
        const {auth, incidentId} = await mintToken();

        invokeMock.mockRejectedValue(new Error('504; Gateway Timeout'))

        const posting = await request(app)
        .post(`/incidents/${incidentId}/ai-draft`)
        .set(auth)
        .send({incidentId: incidentId, context: 'same logged output', kind: 'log'})

        expect(posting.status).toBe(504)
        expect(posting.body.error).toMatch('upstream_error')
    })
})