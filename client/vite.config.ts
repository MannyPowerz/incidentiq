import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// The proxy exists so the browser sees one origin instead of two. Vite serves the app on :5173
// -> and Express listens on :3000, which the browser treats as separate sites — every fetch would be
// ->  blocked by CORS, and the refresh cookie (sameSite: 'strict') would never be sent at all. 
// Rather than adding CORS headers server-side, the dev server forwards these paths so same-origin is
// -> simply true. Dev only: a production deploy needs its own answer (see integration-plan.md §3.1).

export default defineConfig(({ mode }) => {
    // Third argument '' loads vars with no VITE_ prefix. SERVER_ORIGIN deliberately has none —
    // -> that prefix exposes a value to browser code, and this is read here at config time only.

    // Vite does not put .env into process.env while this file runs, so loadEnv is required.
    const env = loadEnv(mode, process.cwd(), '')

    // Fallback keeps a fresh clone working: .env is gitignored, so it will be missing on checkout.
    const httpOrigin = env.SERVER_ORIGIN ?? 'http://localhost:3000'

    // Anchored to the scheme only, and matching 'http' rather than 'http://' — that leaves the 's'
    // -> in place, so an https origin becomes wss without needing a second case.
    const wsOrigin = httpOrigin.replace(/^http/, 'ws')

    return {
        plugins: [react()],
        server: {
            proxy: {

                // One entry per mount in server/src/index.ts. Matching is by prefix, so
                // ->  '/incidents' also covers /incidents/:id/timeline and /incidents/:id/ai-draft.

                '/auth': httpOrigin,
                '/incidents': httpOrigin,
                '/fingerprints': httpOrigin,
                '/health': httpOrigin,

                // Not a route in our code — '/socket.io' is the path the Socket.io client uses by
                // ->  default on both ends. Object form because a WebSocket needs ws: true: the
                // -> connection starts as HTTP and upgrades, and without the flag that upgrade is not
                // -> forwarded, so the handshake succeeds and the socket then silently fails.
                '/socket.io': {
                    target: wsOrigin,
                    ws: true
                }
            }
        }
    }
})
