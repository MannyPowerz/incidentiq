/**
 * routes/index.ts — bundles the four auth endpoints into one router.
 *
 * Each route is a short chain: the shared body-check (validateBody) runs first for the
 * endpoints that take a body, then the handler. refresh and logout carry a cookie rather
 * than a body, so they skip the check. This router gets mounted at /auth in index.ts.
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware.js';
import { handleRegister } from './register.js';
import { handleLogin } from './login.js';
import { handleRefresh } from './refresh.js';
import { handleLogout } from './logout.js';

// the fields register and login expect; validateBody uses this to turn away bad input first
const credentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export const authRouter = Router();

authRouter.post('/register', validateBody(credentialsSchema), handleRegister);
authRouter.post('/login', validateBody(credentialsSchema), handleLogin);
authRouter.post('/refresh', handleRefresh);
authRouter.post('/logout', handleLogout);
