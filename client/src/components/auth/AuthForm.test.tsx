/**
 * AuthForm.test.tsx — the sign-in form's behavior, pinned before and after its reskin.
 *
 * Item 1 rebuilt this form's markup on the ui primitives and promised the logic was untouched.
 * The auth module's own tests (client/src/auth) never render the form, so without this file that
 * promise would be unchecked. login/register are mocked: the network contract is already covered
 * in auth/api.test.ts; this covers what the form does with the result.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock('../../auth/api', async () => {
    const actual = await vi.importActual<typeof import('../../auth/api')>('../../auth/api');
    return { ...actual, login: (...a: unknown[]) => loginMock(...a), register: (...a: unknown[]) => registerMock(...a) };
});

const { default: AuthForm } = await import('./AuthForm');
const { ApiError } = await import('../../auth/api');

function renderForm() {
    return render(
        <MemoryRouter initialEntries={['/signin']}>
            <Routes>
                <Route path="/signin" element={<AuthForm />} />
                <Route path="/rooms" element={<p>Rooms page</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

const email = () => screen.getByLabelText('Email') as HTMLInputElement;
const password = () => screen.getByLabelText('Password') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: /^(sign in|create account|loading)$/i });

beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
});

describe('AuthForm', () => {
    it('labels both fields so they are reachable by name', () => {
        renderForm();
        expect(email().type).toBe('email');
        expect(password().type).toBe('password');
    });

    it('blocks submit and explains when both fields are empty', () => {
        renderForm();
        fireEvent.click(submit());
        expect(screen.getByText('Email is required')).toBeTruthy();
        expect(screen.getByText('Password is required')).toBeTruthy();
        expect(loginMock).not.toHaveBeenCalled();
    });

    // mirrors credentialsSchema min(8) so the user sees a sentence, not the server's raw ZodError
    it('rejects a password under 8 characters before calling the server', () => {
        renderForm();
        fireEvent.change(email(), { target: { name: 'email', value: 'a@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'short' } });
        fireEvent.click(submit());
        expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
        expect(loginMock).not.toHaveBeenCalled();
    });

    it('marks an invalid field and clears the error once the user edits it', () => {
        renderForm();
        fireEvent.click(submit());
        expect(email().getAttribute('aria-invalid')).toBe('true');
        fireEvent.change(email(), { target: { name: 'email', value: 'a' } });
        expect(email().getAttribute('aria-invalid')).toBeNull();
        expect(screen.queryByText('Email is required')).toBeNull();
    });

    it('signs in and lands on /rooms', async () => {
        loginMock.mockResolvedValueOnce('token');
        renderForm();
        fireEvent.change(email(), { target: { name: 'email', value: 'a@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'password123' } });
        fireEvent.click(submit());
        expect(await screen.findByText('Rooms page')).toBeTruthy();
        expect(loginMock).toHaveBeenCalledWith('a@b.com', 'password123');
        expect(registerMock).not.toHaveBeenCalled();
    });

    it('switches to register mode and calls register instead', async () => {
        registerMock.mockResolvedValueOnce('token');
        renderForm();
        fireEvent.click(screen.getByRole('button', { name: 'Create one' }));
        expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
        // the password manager hint follows the mode
        expect(password().getAttribute('autocomplete')).toBe('new-password');

        fireEvent.change(email(), { target: { name: 'email', value: 'new@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
        expect(await screen.findByText('Rooms page')).toBeTruthy();
        expect(registerMock).toHaveBeenCalledWith('new@b.com', 'password123');
    });

    it('shows the server message on a failed sign-in and stays on the page', async () => {
        loginMock.mockRejectedValueOnce(new ApiError(401, 'invalid_credentials', 'Invalid email or password'));
        renderForm();
        fireEvent.change(email(), { target: { name: 'email', value: 'a@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'wrongpass1' } });
        fireEvent.click(submit());
        expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
        expect(screen.queryByText('Rooms page')).toBeNull();
    });

    it('falls back to a network message for a non-API failure', async () => {
        loginMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        renderForm();
        fireEvent.change(email(), { target: { name: 'email', value: 'a@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'password123' } });
        fireEvent.click(submit());
        expect((await screen.findByRole('alert')).textContent).toBe("Couldn't reach the server. Try again.");
    });

    // a second click during a slow request must not send a second login
    it('disables the submit button while the request is in flight', async () => {
        let resolve: (v: string) => void = () => {};
        loginMock.mockReturnValueOnce(new Promise<string>((r) => { resolve = r; }));
        renderForm();
        fireEvent.change(email(), { target: { name: 'email', value: 'a@b.com' } });
        fireEvent.change(password(), { target: { name: 'password', value: 'password123' } });
        fireEvent.click(submit());

        const busy = screen.getByRole('button', { name: /loading/i }) as HTMLButtonElement;
        expect(busy.disabled).toBe(true);
        fireEvent.click(busy);
        expect(loginMock).toHaveBeenCalledTimes(1);

        resolve('token');
        expect(await screen.findByText('Rooms page')).toBeTruthy();
    });

    it('toggles password visibility and reports the pressed state', () => {
        renderForm();
        const toggle = screen.getByRole('button', { name: 'Show password' });
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(toggle);
        expect(password().type).toBe('text');
        expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe('true');
    });
});
