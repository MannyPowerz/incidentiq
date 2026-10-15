/**
 * traceScript — what the code panes behind the page play, and how far along each one is.
 *
 * Every story is a failure this app exists to catch: nothing throws, an AI assistant reading the
 * file would not see it, and it only shows up when a teammate's machine disagrees. Each one plays
 * the product's loop: the code is typed, the scanner flags it, a fix lands as a diff, and it ends
 * on a green check.
 *
 * Playback is a pure function of one tick count, so the component only has to count.
 */

export type LineKind = 'code' | 'cmd' | 'out' | 'flag' | 'del' | 'add' | 'ok';

export type Line = { text: string; kind: LineKind };

export type Story = { pane: 'editor' | 'terminal'; title: string; lines: Line[] };

const code = (text: string): Line => ({ text, kind: 'code' });
const cmd = (text: string): Line => ({ text, kind: 'cmd' });
const out = (text: string): Line => ({ text, kind: 'out' });
const flag = (text: string): Line => ({ text, kind: 'flag' });
const del = (text: string): Line => ({ text, kind: 'del' });
const add = (text: string): Line => ({ text, kind: 'add' });
const ok = (text: string): Line => ({ text, kind: 'ok' });

export const STORIES: Story[] = [
    {
        pane: 'editor',
        title: 'vite.config.ts',
        lines: [
            code('server: {'),
            code('  proxy: {'),
            code("    '/incidents': 'http://localhost:4000',"),
            flag('ECONNRESET :4000, the API listens on :3000'),
            del("    '/incidents': 'http://localhost:4000',"),
            add("    '/incidents': 'http://localhost:3000',"),
            ok('caught before it reached the team'),
        ],
    },
    {
        pane: 'terminal',
        title: 'agent',
        lines: [
            cmd('incidentioq scan'),
            out('ports, interfaces, lockfile, migrations'),
            flag('VPN up: localhost:5173 silent, no error thrown'),
            out('private card ready, nothing posted'),
            cmd('incidentioq post --room 42'),
            ok('stored #43, then broadcast to 2 teammates'),
        ],
    },
    {
        pane: 'editor',
        title: 'fingerprint.json',
        lines: [
            code('"node": "20.11.1",'),
            code('"lockfile": "a91f2c",'),
            flag('main runs node 22.4.0, lockfile 3c07e1'),
            del('"node": "20.11.1",'),
            add('"node": "22.4.0",'),
            ok('works on every machine, not just this one'),
        ],
    },
    {
        pane: 'terminal',
        title: 'migrate',
        lines: [
            cmd('npm run migrate'),
            out('applied 0007_entries_org.sql'),
            flag("a teammate's laptop never ran 0007"),
            out('flagged for the teammate who touched it 2 days ago'),
            ok('migrations in sync'),
        ],
    },
    {
        pane: 'editor',
        title: 'timeline.ts',
        lines: [
            code('const rows = await pool.query('),
            code('  `SELECT * FROM entries ORDER BY created_at`'),
            flag('sockets arrive out of order, so the clock lies'),
            del('  ORDER BY created_at'),
            add('  ORDER BY incident_id, entry_id'),
            ok('every teammate sees one order'),
        ],
    },
];

// code and commands are typed a character per tick; output, flags and diffs land whole after a beat
const TYPED: ReadonlySet<LineKind> = new Set(['code', 'cmd']);
export const BEAT = 10;
// how long a finished story stays up before its pane leaves
export const HOLD = 45;
// how long the pane takes to fade out
export const FADE = 12;

function cost(line: Line): number {
    return TYPED.has(line.kind) ? line.text.length : BEAT;
}

export function storyLength(story: Story): number {
    return story.lines.reduce((sum, l) => sum + cost(l), 0);
}

// the whole life of a pane showing this story: play it, hold it, fade it
export function lifetime(story: Story): number {
    return storyLength(story) + HOLD + FADE;
}

export type Shown = { text: string; kind: LineKind; typing: boolean };

/** The lines on screen `tick` ticks into the story. A line being typed shows its typed part, with a caret. */
export function reveal(story: Story, tick: number): Shown[] {
    const shown: Shown[] = [];
    let left = tick;
    for (const line of story.lines) {
        if (left <= 0) break;
        const c = cost(line);
        if (left >= c) {
            shown.push({ text: line.text, kind: line.kind, typing: false });
        } else if (TYPED.has(line.kind)) {
            shown.push({ text: line.text.slice(0, left), kind: line.kind, typing: true });
        }
        left -= c;
    }
    return shown;
}
