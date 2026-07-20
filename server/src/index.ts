import 'dotenv/config';
import express from 'express';
import { pool } from './db/pool.js';
import * as http from 'node:http'
import {Server} from 'socket.io'
import type { ClientToServerJoining } from './InterfaceTypes/socket.js';
import { socketHandlerFunction } from './routes/socketHandlerFunctions.js';

// Fail fast if DATABASE_URL is unreachable — before accepting any traffic
const client = await pool.connect();
client.release();

const app = express();
const server = http.createServer(app) //wraps our existing app
const io = new Server<ClientToServerJoining>(server)//intergrate socket.io and implemented as an instance

const port = process.env.PORT ?? 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('User joined: ', socket.id)

  socketHandlerFunction(io, socket)
})

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
