/**
 * sheet.test.tsx — the floating layers (sign-in, modals, toasts) are glass sheets and content is not;
 * every sheet state is in the stylesheet; and no sheet animation survives reduced motion. CSS cannot
 * run in jsdom (:has, backdrop-filter), so the stylesheet is held by its structure, and the states are
 * checked in a real browser before merging.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import css from './utilities.css?raw';
import AuthForm from '../components/auth/AuthForm';
import { Card, Modal } from '../components/ui';

// the rules inside the one @media block that follows `start`
function mediaBlock(text: string, start: number): string {
    let depth = 0;
    const open = text.indexOf('{', start);
    for (let i = open; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(open, i);
    }
    throw new Error('unclosed block');
}

describe('sheets', () => {
    it('makes the sign-in form a glass sheet', () => {
        const { container } = render(
            <MemoryRouter>
                <AuthForm />
            </MemoryRouter>,
        );
        expect(container.querySelector('form')!.className).toContain('ui-glass ui-sheet');
    });

    it('makes the modal panel a glass sheet', () => {
        render(
            <Modal open onClose={() => {}} title="New room">
                body
            </Modal>,
        );
        expect(screen.getByRole('dialog').className).toContain('ui-glass ui-sheet');
    });

    it('leaves content cards solid', () => {
        const { container } = render(<Card>content</Card>);
        expect(container.firstElementChild!.className).not.toMatch(/ui-glass|ui-sheet/);
    });

    it('defines every state a sheet can be in', () => {
        const sheet = css.slice(css.indexOf('.ui-sheet {'));
        for (const state of [
            '.ui-sheet:hover',
            '.ui-sheet:focus-within',
            '.ui-sheet:has(.ui-btn--loading, .ui-livedot--syncing)::after',
            ".ui-sheet:has([role='alert']):not(.ui-toast)",
        ]) {
            expect(sheet).toContain(state);
        }
    });

    it('stops every sheet animation under reduced motion', () => {
        const start = css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.ui-sheet {'));
        const block = mediaBlock(css, start);
        expect(block).toContain('.ui-sheet,');
        expect(block).toContain('.ui-sheet::after');
        expect(block).toMatch(/animation:\s*none !important/);
    });
});
