/**
 * ideScript — the work the background IDE does, and one pure step of it.
 *
 * The script is a developer's session on this app: fix a proxy the scanner caught, fix a timeline
 * sorted by the clock after a test fails, catch a VPN eating localhost and post it to a room, bring
 * a drifted Node version back in line with main, and write a migration. Code is typed, erased and
 * retyped a character per step, commands are typed into the terminal, and output lands whole.
 *
 * `step` is pure, so the component only decides when to call it (your input, or autopilot), and the
 * whole session can be tested without a DOM. At the end the files reset and the session loops.
 */

export type Mark = 'flag' | 'ok';
export type TermKind = 'cmd' | 'out' | 'flag' | 'ok' | 'fail';
export type TermLine = { text: string; kind: TermKind; typing: boolean };

export type Op =
    | { k: 'open'; file: string }
    // col omitted: the end of the line
    | { k: 'goto'; line: number; col?: number }
    | { k: 'type'; text: string }
    | { k: 'erase'; n: number }
    | { k: 'newline' }
    | { k: 'mark'; mark: Mark }
    | { k: 'run'; cmd: string }
    | { k: 'out'; text: string; kind?: Exclude<TermKind, 'cmd'> }
    | { k: 'wait'; n: number };

export type IdeState = {
    files: Record<string, string[]>;
    tabs: string[];
    open: string;
    caret: { line: number; col: number };
    // `${file}:${line}` -> mark, so a flag stays on its file when the tab changes
    marks: Record<string, Mark>;
    terminal: TermLine[];
    op: number;
    at: number;
};

export const FILES: Record<string, string[]> = {
    'vite.config.ts': [
        "import { defineConfig } from 'vite';",
        "import react from '@vitejs/plugin-react';",
        '',
        'export default defineConfig({',
        '  plugins: [react()],',
        '  server: {',
        '    proxy: {',
        "      '/incidents': 'http://localhost:4000',",
        "      '/auth': 'http://localhost:3000',",
        "      '/socket.io': { target: 'http://localhost:3000', ws: true },",
        '    },',
        '  },',
        '});',
    ],
    'timeline.ts': [
        'export async function listEntries(incidentId: number, orgId: number) {',
        '  const { rows } = await pool.query(',
        '    `SELECT e.* FROM entries e',
        '       JOIN incidents i ON i.id = e.incident_id',
        '      WHERE e.incident_id = $1 AND i.org_id = $2',
        '      ORDER BY created_at`,',
        '    [incidentId, orgId],',
        '  );',
        '  return rows;',
        '}',
    ],
    'package.json': [
        '{',
        '  "name": "incidentioq-client",',
        '  "engines": {',
        '    "node": "20.11.1"',
        '  },',
        '  "scripts": {',
        '    "dev": "vite",',
        '    "test": "vitest"',
        '  }',
        '}',
    ],
    '0007_entries_org.sql': ['-- every read is scoped by org'],
};

const o = (file: string): Op => ({ k: 'open', file });
const go = (line: number, col?: number): Op => (col === undefined ? { k: 'goto', line } : { k: 'goto', line, col });
const type = (text: string): Op => ({ k: 'type', text });
const erase = (n: number): Op => ({ k: 'erase', n });
const nl: Op = { k: 'newline' };
const mark = (m: Mark): Op => ({ k: 'mark', mark: m });
const run = (cmd: string): Op => ({ k: 'run', cmd });
const out = (text: string, kind?: Exclude<TermKind, 'cmd'>): Op => (kind ? { k: 'out', text, kind } : { k: 'out', text });
const wait = (n: number): Op => ({ k: 'wait', n });

export const SCRIPT: Op[] = [
    // 1. the dev server comes up, the scanner catches the proxy on the wrong port, the fix lands
    o('vite.config.ts'),
    run('npm run dev'),
    wait(8),
    out('VITE ready in 312 ms  ➜  http://localhost:5173/'),
    wait(10),
    out('incidentioq: ECONNRESET :4000, the API listens on :3000', 'flag'),
    go(7),
    mark('flag'),
    wait(12),
    go(7, 42),
    erase(4),
    type('3000'),
    mark('ok'),
    wait(8),
    run('npm test'),
    wait(10),
    out('42 passed', 'ok'),
    run('git commit -am "fix: proxy points at the API port"'),
    out('[ui/live 3f2a1c9] 1 file changed, 1 insertion(+), 1 deletion(-)'),
    wait(16),

    // 2. a test catches the timeline sorted by arrival time; sort by entry_id instead
    o('timeline.ts'),
    go(5),
    wait(8),
    run('npm test'),
    wait(10),
    out('timeline › orders by entry_id, not arrival time', 'fail'),
    mark('flag'),
    go(5, 25),
    erase(10),
    type('e.incident_id, e.entry_id'),
    mark('ok'),
    run('npm test'),
    wait(10),
    out('43 passed', 'ok'),
    wait(14),

    // 3. the scanner catches a silent VPN failure; a human posts it to the room
    run('incidentioq scan'),
    wait(8),
    out('ports, interfaces, lockfile, migrations'),
    wait(6),
    out('VPN up: localhost:5173 silent, no error thrown', 'flag'),
    out('private card ready, nothing posted'),
    wait(12),
    run('incidentioq post --room 42'),
    out('stored #43, then broadcast to 2 teammates', 'ok'),
    wait(16),

    // 4. this machine drifted from main; bring Node back in line
    o('package.json'),
    run('incidentioq fingerprint --diff main'),
    wait(8),
    out('node 20.11.1 here, 22.4.0 on main', 'flag'),
    go(3),
    mark('flag'),
    go(3, 20),
    erase(7),
    type('22.4.0'),
    mark('ok'),
    run('npm install'),
    wait(10),
    out('fingerprint matches main', 'ok'),
    wait(14),

    // 5. a migration one laptop never ran: write it, run it, the room sees it in sync
    o('0007_entries_org.sql'),
    go(0),
    nl,
    type('ALTER TABLE entries'),
    nl,
    type('  ADD COLUMN org_id integer NOT NULL REFERENCES orgs(id);'),
    nl,
    type('CREATE INDEX entries_org_idx ON entries (org_id, incident_id, entry_id);'),
    run('npm run migrate'),
    wait(8),
    out('applied 0007_entries_org.sql'),
    out("a teammate's laptop never ran 0007", 'flag'),
    out('flagged for the teammate who touched it 2 days ago'),
    wait(10),
    out('migrations in sync', 'ok'),
    run('git push'),
    out('ui/live -> ui/live'),
    wait(24),
];

// how many terminal lines stay on screen
export const TERMINAL_LINES = 7;

export function initialState(): IdeState {
    return {
        files: Object.fromEntries(Object.entries(FILES).map(([name, lines]) => [name, [...lines]])),
        tabs: ['vite.config.ts'],
        open: 'vite.config.ts',
        caret: { line: 0, col: 0 },
        marks: {},
        terminal: [],
        op: 0,
        at: 0,
    };
}

const next = (s: IdeState): IdeState => ({ ...s, op: s.op + 1, at: 0 });

function edit(s: IdeState, line: number, text: string): Record<string, string[]> {
    const lines = [...s.files[s.open]!];
    lines[line] = text;
    return { ...s.files, [s.open]: lines };
}

/** One step of the session: one character typed or erased, or one whole action. */
export function step(s: IdeState): IdeState {
    const op = SCRIPT[s.op];
    // the session is over: start again from clean files, keeping the terminal's scrollback
    if (!op) return { ...initialState(), terminal: s.terminal };

    const lines = s.files[s.open]!;
    const { line, col } = s.caret;
    const current = lines[line] ?? '';

    switch (op.k) {
        case 'open':
            return next({ ...s, open: op.file, tabs: s.tabs.includes(op.file) ? s.tabs : [...s.tabs, op.file], caret: { line: 0, col: 0 } });
        case 'goto': {
            const text = lines[op.line] ?? '';
            return next({ ...s, caret: { line: op.line, col: Math.min(op.col ?? text.length, text.length) } });
        }
        case 'type': {
            const files = edit(s, line, current.slice(0, col) + op.text[s.at] + current.slice(col));
            const moved = { ...s, files, caret: { line, col: col + 1 }, at: s.at + 1 };
            return moved.at >= op.text.length ? next(moved) : moved;
        }
        case 'erase': {
            const files = col > 0 ? edit(s, line, current.slice(0, col - 1) + current.slice(col)) : s.files;
            const moved = { ...s, files, caret: { line, col: Math.max(0, col - 1) }, at: s.at + 1 };
            return moved.at >= op.n ? next(moved) : moved;
        }
        case 'newline': {
            const updated = [...lines.slice(0, line + 1), '', ...lines.slice(line + 1)];
            return next({ ...s, files: { ...s.files, [s.open]: updated }, caret: { line: line + 1, col: 0 } });
        }
        case 'mark':
            return next({ ...s, marks: { ...s.marks, [`${s.open}:${line}`]: op.mark } });
        case 'run': {
            const started = s.at === 0 ? [...s.terminal, { text: '', kind: 'cmd' as const, typing: true }] : s.terminal;
            const last = started[started.length - 1]!;
            const text = last.text + op.cmd[s.at];
            const done = s.at + 1 >= op.cmd.length;
            const terminal = [...started.slice(0, -1), { text, kind: 'cmd' as const, typing: !done }].slice(-TERMINAL_LINES);
            return done ? next({ ...s, terminal }) : { ...s, terminal, at: s.at + 1 };
        }
        case 'out':
            return next({ ...s, terminal: [...s.terminal, { text: op.text, kind: op.kind ?? 'out', typing: false }].slice(-TERMINAL_LINES) });
        case 'wait':
            return s.at + 1 >= op.n ? next(s) : { ...s, at: s.at + 1 };
    }
}

export function stepN(s: IdeState, n: number): IdeState {
    let state = s;
    for (let i = 0; i < n; i++) state = step(state);
    return state;
}
