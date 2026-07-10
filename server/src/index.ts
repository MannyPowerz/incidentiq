import 'dotenv/config';
import express from 'express';
import { pool } from './db/pool.js';
import * as http from 'node:http'
import {Server} from 'socket.io'

// Fail fast if DATABASE_URL is unreachable — before accepting any traffic
const client = await pool.connect();
client.release();

const app = express();
const server = http.createServer(app) //wraps our existing app
const io = new Server(server)//intergrate socket.io and implmented as an instance
const port = process.env.PORT ?? 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

//basic connection
io.on('connection', (socket) => {
  console.log("A user connected");
  socket.on('disconnect', () => {
    console.log("User disconnected")
  })
})


server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
