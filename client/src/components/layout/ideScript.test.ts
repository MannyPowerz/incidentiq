/**
 * ideScript.test.ts — each kind of step does what an editor and a shell would, the caret never
 * leaves the text, the session's fixes really land in the files, and it loops back to clean files.
 */

import { describe, it, expect } from 'vitest';
import { FILES, SCRIPT, TERMINAL_LINES, initialState, step, stepN } from './ideScript';
import type { IdeState, Op } from './ideScript';

// a state sitting just before the given op, with the given file open and caret
function at(op: Op, patch: Partial<IdeState> = {}): IdeState {
    const index = SCRIPT.findIndex((o) => o === op);
    return { ...initialState(), files: { 'a.ts': ['abcdef', 'xyz'] }, tabs: ['a.ts'], open: 'a.ts', ...patch, op: index, at: 0 };
}
const find = (k: Op['k']) => SCRIPT.find((o) => o.k === k)!;

// every state of one full session, start to end
function session(): IdeState[] {
    const states = [initialState()];
    while (states.at(-1)!.op < SCRIPT.length) states.push(step(states.at(-1)!));
    return states;
}

describe('step', () => {
    it('types one character at the caret per step, then moves to the next op', () => {
        const op = find('type') as Extract<Op, { k: 'type' }>;
        let s = at(op, { caret: { line: 0, col: 3 } });
        s = step(s);
        expect(s.files['a.ts']![0]).toBe(`abc${op.text[0]}def`);
        expect(s.caret).toEqual({ line: 0, col: 4 });
        s = stepN(s, op.text.length - 1);
        expect(s.files['a.ts']![0]).toBe(`abc${op.text}def`);
        expect(s.op).toBe(SCRIPT.indexOf(op) + 1);
    });

    it('erases one character before the caret per step', () => {
        const op = find('erase') as Extract<Op, { k: 'erase' }>;
        const s = step(at(op, { caret: { line: 0, col: 6 } }));
        expect(s.files['a.ts']![0]).toBe('abcde');
        expect(s.caret.col).toBe(5);
    });

    it('goes to the end of a line unless told the column', () => {
        const s = step({ ...initialState(), op: SCRIPT.findIndex((o) => o.k === 'goto' && o.col === undefined) });
        const target = (SCRIPT[s.op - 1] as Extract<Op, { k: 'goto' }>).line;
        expect(s.caret).toEqual({ line: target, col: s.files[s.open]![target]!.length });
    });

    it('opens a new line below the caret and moves onto it', () => {
        const s = step(at(find('newline'), { caret: { line: 0, col: 2 } }));
        expect(s.files['a.ts']).toEqual(['abcdef', '', 'xyz']);
        expect(s.caret).toEqual({ line: 1, col: 0 });
    });

    it('flags the caret line in its own file, and the fix replaces the flag', () => {
        const flag = SCRIPT.find((o) => o.k === 'mark' && o.mark === 'flag')!;
        const ok = SCRIPT.find((o) => o.k === 'mark' && o.mark === 'ok')!;
        let s = step(at(flag, { caret: { line: 1, col: 0 } }));
        expect(s.marks).toEqual({ 'a.ts:1': 'flag' });
        s = step({ ...s, op: SCRIPT.indexOf(ok) });
        expect(s.marks).toEqual({ 'a.ts:1': 'ok' });
    });

    it('types a command into the terminal, then output lands whole', () => {
        const op = find('run') as Extract<Op, { k: 'run' }>;
        let s = step(at(op));
        expect(s.terminal.at(-1)).toEqual({ text: op.cmd[0], kind: 'cmd', typing: true });
        s = stepN(s, op.cmd.length - 1);
        expect(s.terminal.at(-1)).toEqual({ text: op.cmd, kind: 'cmd', typing: false });
        expect(s.op).toBe(SCRIPT.indexOf(op) + 1);
    });

    it('keeps only the last lines of the terminal', () => {
        const op = find('out');
        const full = Array.from({ length: TERMINAL_LINES }, (_, i) => ({ text: `l${i}`, kind: 'out' as const, typing: false }));
        const s = step(at(op, { terminal: full }));
        expect(s.terminal).toHaveLength(TERMINAL_LINES);
        expect(s.terminal[0]!.text).toBe('l1');
    });

    it('opens a file in a new tab once, and switches to it', () => {
        const op = find('open') as Extract<Op, { k: 'open' }>;
        const s = step(at(op, { tabs: ['a.ts', op.file] }));
        expect(s.open).toBe(op.file);
        expect(s.tabs).toEqual(['a.ts', op.file]);
    });
});

describe('the session', () => {
    const states = session();
    const end = states.at(-1)!;

    it('never puts the caret outside the text', () => {
        for (const s of states) {
            const lines = s.files[s.open]!;
            expect(s.caret.line).toBeLessThan(lines.length);
            expect(s.caret.col).toBeLessThanOrEqual(lines[s.caret.line]!.length);
        }
    });

    it('lands every fix it sets out to make', () => {
        expect(end.files['vite.config.ts']![7]).toBe("      '/incidents': 'http://localhost:3000',");
        expect(end.files['timeline.ts']![5]).toBe('      ORDER BY e.incident_id, e.entry_id`,');
        expect(end.files['package.json']![3]).toBe('    "node": "22.4.0"');
        expect(end.files['0007_entries_org.sql']).toHaveLength(4);
        expect(Object.values(end.marks).every((m) => m === 'ok')).toBe(true);
    });

    it('fails a test before it passes, the way real work goes', () => {
        const kinds = end.terminal.map((t) => t.kind);
        expect(kinds).toContain('ok');
        const lines = states.flatMap((s) => s.terminal).map((t) => t.kind);
        expect(lines.indexOf('fail')).toBeGreaterThan(-1);
    });

    it('loops back to clean files and keeps the scrollback', () => {
        const again = step(end);
        expect(again.op).toBe(0);
        expect(again.files).toEqual(FILES);
        expect(again.terminal).toEqual(end.terminal);
    });
});
