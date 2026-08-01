/**
 * socketServer.ts — the shared Express app, http server, and Socket.io instance, constructed
 * once. Same pattern as db/pool.ts: a module body runs once and is cached, so `io` here is
 * effectively a singleton — any route handler that needs to broadcast (e.g. after a DB write)
 * imports it directly instead of threading it through req/res or an untyped app.get('io').
 */

import express from 'express';
import * as http from 'node:http';
import { Server } from 'socket.io';
import type { TypeServer } from './Socket/InterfaceTypes/socket.js';

export const app = express();
export const server = http.createServer(app); // wraps the Express app so Socket.io can share the same port
export const io: TypeServer = new Server(server);
