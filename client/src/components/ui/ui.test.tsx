/**
 * ui.test.tsx — every primitive's states, asserted on behavior and accessibility, not markup.
 *
 * These are the contracts screens build on: a label is wired to its input, an error is announced,
 * a loading button can't be double-submitted, a modal traps focus and gives it back. A screen that
 * breaks one of these breaks it for every page at once, which is why they're pinned here.
 */

import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    ErrorState,
    Input,
    Modal,
    Select,
    Spinner,
    Table,
    Textarea,
    ToastProvider,
    useToast,
} from './index';

describe('Button', () => {
    it('defaults to type="button" so it never submits a form by accident', () => {
        render(<Button>Save</Button>);
        expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
    });

    it('fires onClick when enabled', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Save</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    // the double-submit guard: a slow create-room request must not post twice
    it('is disabled and busy while loading, and ignores clicks', () => {
        const onClick = vi.fn();
        render(
            <Button loading onClick={onClick}>
                Save
            </Button>,
        );
        const button = screen.getByRole('button');
        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByRole('status')).toBeTruthy();
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('applies the variant class', () => {
        render(<Button variant="danger">Delete</Button>);
        expect(screen.getByRole('button').className).toContain('ui-btn--danger');
    });
});

describe('Input', () => {
    it('wires the label to the control', () => {
        render(<Input label="Email" />);
        expect(screen.getByLabelText('Email').tagName).toBe('INPUT');
    });

    it('marks the control invalid and announces the error', () => {
        render(<Input label="Email" error="Enter a valid email" />);
        const input = screen.getByLabelText('Email');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toBe('Enter a valid email');
        // the error is reachable from the input itself, not just nearby on screen
        expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    });

    it('is not invalid when there is no error', () => {
        render(<Input label="Email" />);
        expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('describes the control with its hint', () => {
        render(<Input label="Password" hint="At least 8 characters" />);
        const describedBy = screen.getByLabelText('Password').getAttribute('aria-describedby') ?? '';
        expect(document.getElementById(describedBy)?.textContent).toBe('At least 8 characters');
    });

    it('renders a trailing control inside the field without breaking the label link', () => {
        render(<Input label="Password" trailing={<button>Show</button>} />);
        expect(screen.getByLabelText('Password').tagName).toBe('INPUT');
        expect(screen.getByRole('button', { name: 'Show' }).closest('.ui-field__trailing')).toBeTruthy();
    });

    it('gives each instance a distinct id', () => {
        render(
            <>
                <Input label="One" />
                <Input label="Two" />
            </>,
        );
        expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
    });
});

describe('Select', () => {
    const options = [
        { value: 'P1', label: 'P1 — critical' },
        { value: 'P2', label: 'P2 — high' },
    ];

    it('renders every option and reports changes', () => {
        const onChange = vi.fn();
        render(<Select label="Severity" options={options} defaultValue="P1" onChange={onChange} />);
        const select = screen.getByLabelText('Severity') as HTMLSelectElement;
        expect(select.options).toHaveLength(2);
        fireEvent.change(select, { target: { value: 'P2' } });
        expect(onChange).toHaveBeenCalled();
        expect(select.value).toBe('P2');
    });

    // an unchosen affected_system must look unchosen, not silently default to the first key
    it('shows a disabled placeholder option when given one', () => {
        render(<Select label="System" options={options} placeholder="Choose a system" defaultValue="" />);
        const select = screen.getByLabelText('System') as HTMLSelectElement;
        expect(select.options[0]?.textContent).toBe('Choose a system');
        expect(select.options[0]?.disabled).toBe(true);
        expect(select.value).toBe('');
    });

    it('announces an error', () => {
        render(<Select label="System" options={options} error="Pick a system" />);
        expect(screen.getByRole('alert').textContent).toBe('Pick a system');
    });
});

describe('Textarea', () => {
    it('wires the label and applies the mono style for pasted logs', () => {
        render(<Textarea label="Log context" mono />);
        const textarea = screen.getByLabelText('Log context');
        expect(textarea.tagName).toBe('TEXTAREA');
        expect(textarea.className).toContain('ui-field__control--mono');
    });
});

describe('Badge', () => {
    it('uppercases severity and picks its color class', () => {
        render(<Badge tone="severity" value="p1" />);
        const badge = screen.getByText('P1');
        expect(badge.className).toContain('ui-badge--severity-p1');
    });

    it('capitalises status', () => {
        render(<Badge tone="status" value="investigating" />);
        expect(screen.getByText('Investigating').className).toContain('ui-badge--status-investigating');
    });

    it('labels an ai_draft entry readably', () => {
        render(<Badge tone="entry" value="ai_draft" />);
        expect(screen.getByText('AI draft').className).toContain('ui-badge--entry-ai_draft');
    });

    it('lets a label override the text while the value still sets the color', () => {
        render(<Badge tone="severity" value="P2" label="High" />);
        expect(screen.getByText('High').className).toContain('ui-badge--severity-p2');
    });
});

describe('Card', () => {
    it('renders a title as a heading, and actions', () => {
        render(
            <Card title="Timeline" actions={<Button>Add</Button>}>
                body
            </Card>,
        );
        expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
        expect(screen.getByText('body')).toBeTruthy();
    });

    it('renders no header when there is neither title nor actions', () => {
        const { container } = render(<Card>body</Card>);
        expect(container.querySelector('.ui-card__header')).toBeNull();
    });
});

describe('Spinner', () => {
    it('is a status region with an accessible label', () => {
        render(<Spinner label="Loading rooms" />);
        expect(screen.getByRole('status').textContent).toBe('Loading rooms');
    });
});

describe('Modal', () => {
    function Harness({ onClose = () => {} }: { onClose?: () => void }) {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button onClick={() => setOpen(true)}>Open</button>
                <Modal
                    open={open}
                    title="Create room"
                    onClose={() => {
                        onClose();
                        setOpen(false);
                    }}
                >
                    <input aria-label="Title" />
                    <button>Create</button>
                </Modal>
            </>
        );
    }

    it('renders nothing while closed', () => {
        render(<Modal open={false} onClose={() => {}} title="X">body</Modal>);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('is a labelled modal dialog that focuses its first control', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('Open'));
        const dialog = screen.getByRole('dialog', { name: 'Create room' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    });

    it('closes on Escape and returns focus to the opener', () => {
        const onClose = vi.fn();
        render(<Harness onClose={onClose} />);
        const opener = screen.getByText('Open');
        opener.focus();
        fireEvent.click(opener);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
    });

    it('closes on the close button', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('Open'));
        fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // the trap: Tab off the last control wraps to the first instead of leaving the dialog
    it('wraps Tab from the last control back to the first', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('Open'));
        const last = screen.getByRole('button', { name: 'Create' });
        last.focus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
    });

    it('wraps Shift+Tab from the first control to the last', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('Open'));
        screen.getByRole('button', { name: 'Close dialog' }).focus();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create' }));
    });

    it('locks page scroll while open and restores it on close', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('Open'));
        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(document.body.style.overflow).toBe('');
    });
});

describe('Table', () => {
    type Row = { id: number; title: string };
    const columns = [
        { key: 'id', header: 'ID', render: (r: Row) => r.id },
        { key: 'title', header: 'Title', render: (r: Row) => r.title },
    ];

    it('renders headers as column headers and one row per item', () => {
        render(<Table columns={columns} rows={[{ id: 1, title: 'DB down' }]} rowKey={(r) => r.id} empty={<p>none</p>} />);
        expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['ID', 'Title']);
        expect(screen.getByText('DB down')).toBeTruthy();
    });

    // the phone layout reads the header from this attribute; without it the stacked cards are unlabelled
    it('labels every cell with its column header', () => {
        render(<Table columns={columns} rows={[{ id: 1, title: 'DB down' }]} rowKey={(r) => r.id} empty={<p>none</p>} />);
        expect(screen.getByText('DB down').closest('td')?.getAttribute('data-label')).toBe('Title');
    });

    it('renders the empty state instead of an empty table', () => {
        render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>No rooms yet</p>} />);
        expect(screen.getByText('No rooms yet')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
    });
});

describe('EmptyState and ErrorState', () => {
    it('EmptyState shows title, body, and action', () => {
        render(<EmptyState title="No rooms yet" body="Create one to start." action={<Button>Create room</Button>} />);
        expect(screen.getByText('No rooms yet')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Create room' })).toBeTruthy();
    });

    it('ErrorState is announced and offers a retry when given one', () => {
        const retry = vi.fn();
        render(<ErrorState title="Couldn't load rooms" body="Can't reach the server." retry={retry} />);
        expect(screen.getByRole('alert').textContent).toContain("Couldn't load rooms");
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('ErrorState has no retry button without a handler', () => {
        render(<ErrorState title="Gone" body="This room does not exist." />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('Toast', () => {
    function Trigger({ tone, message }: { tone: 'success' | 'error' | 'info'; message: string }) {
        const { show } = useToast();
        return <button onClick={() => show(tone, message, 1000)}>fire {message}</button>;
    }

    it('shows a message and auto-dismisses it after its duration', () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger tone="success" message="Room created" />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('fire Room created'));
        expect(screen.getByText('Room created')).toBeTruthy();
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.queryByText('Room created')).toBeNull();
        vi.useRealTimers();
    });

    // errors interrupt; everything else waits its turn
    it('puts errors in the assertive region and the rest in the polite one', () => {
        render(
            <ToastProvider>
                <Trigger tone="error" message="Failed" />
                <Trigger tone="info" message="Heads up" />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('fire Failed'));
        fireEvent.click(screen.getByText('fire Heads up'));
        expect(screen.getByText('Failed').closest('[aria-live]')?.getAttribute('aria-live')).toBe('assertive');
        expect(screen.getByText('Heads up').closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
    });

    it('can be dismissed by hand', () => {
        render(
            <ToastProvider>
                <Trigger tone="info" message="Heads up" />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('fire Heads up'));
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
        expect(screen.queryByText('Heads up')).toBeNull();
    });

    it('keeps at most three, dropping the oldest', () => {
        function Many() {
            const { show } = useToast();
            return <button onClick={() => ['a', 'b', 'c', 'd'].forEach((m) => show('info', `msg ${m}`))}>fire all</button>;
        }
        render(
            <ToastProvider>
                <Many />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('fire all'));
        expect(screen.queryByText('msg a')).toBeNull();
        expect(screen.getByText('msg d')).toBeTruthy();
        expect(screen.getAllByText(/^msg /)).toHaveLength(3);
    });

    it('throws when used outside the provider, so a missing provider fails loudly', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Trigger tone="info" message="x" />)).toThrow(/ToastProvider/);
        spy.mockRestore();
    });
});
