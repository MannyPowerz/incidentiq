/**
 * index.ts — server entry point: prove the database is reachable, then start
 * listening. Standard Express bootstrap; the one deliberate bit is the fail-fast
 * DB check below. Uses the shared pool from db/pool.ts.
 */
import 'dotenv/config';
import express from 'express';
import { pool } from './db/pool.js';
import * as http from 'node:http'
import {Server, Socket} from 'socket.io'
import type { ClientToServerJoining } from './InterfaceTypes/socket.js';
import { socketHandlerFunction } from './routes/socketHandlerFunctions.js';

// Fail fast if the DB is unreachable BEFORE we accept any traffic. A server that
// booted on a dead pool would still pass its own /health check and only start
// failing on the first real query — better to crash at startup where it's obvious.
const client = await pool.connect();
client.release();

const app = express();
const server = http.createServer(app) //wraps our existing app
const io = new Server<ClientToServerJoining>(server)//intergrate socket.io and implemented as an instance

const port = process.env.PORT ?? 3000;

// Liveness only: returns 200 without touching the DB. Readiness was already gated
// once by the pool.connect() above, so this deliberately doesn't ping Postgres per hit.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connect', (socket:Socket) => {
  console.log('User joined: ', socket.id)

  socketHandlerFunction(io, socket)
})

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
