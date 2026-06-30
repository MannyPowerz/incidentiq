import 'dotenv/config';
import express from 'express';
import { pool } from './db/pool.js';

// Fail fast if DATABASE_URL is unreachable — before accepting any traffic
const client = await pool.connect();
client.release();

const app = express();
const port = process.env.PORT ?? 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
