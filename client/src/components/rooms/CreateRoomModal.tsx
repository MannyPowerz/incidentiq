import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { ApiError, createIncident, SEVERITIES } from '../../api';
import type { Incident, Severity } from '../../api';
import { Button, Input, Modal, Select } from '../ui';
import './CreateRoomModal.css';

/**
 * The keys of SYSTEM_TO_PATHS in server/src/relevance/systemPaths.ts, copied by hand (no shared package).
 * A closed list, not free text: relevance maps the system to code paths, and a typo there scores nobody.
 * Add a key there, add it here.
 */
export const AFFECTED_SYSTEMS = [
    'auth',
    'timeline',
    'incidents',
    'fingerprints',
    'relevance',
    'sockets',
    'postgres',
    'database',
    'client',
    'server',
] as const;

const SEVERITY_LABEL: Record<Severity, string> = {
    P1: 'P1 — outage, drop everything',
    P2: 'P2 — major, someone on it now',
    P3: 'P3 — degraded, today',
    P4: 'P4 — minor, when there is time',
};

type CreateRoomModalProps = {
    open: boolean;
    onClose: () => void;
    onCreated: (incident: Incident) => void;
};

export default function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps): JSX.Element {
    return (
        <Modal open={open} onClose={onClose} title="New room">
            {/* the form mounts with the dialog, so every open starts blank without a reset effect */}
            <CreateRoomForm onCancel={onClose} onCreated={onCreated} />
        </Modal>
    );
}

type FieldErrors = Partial<Record<'title' | 'severity' | 'system', string>>;

function CreateRoomForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (incident: Incident) => void }): JSX.Element {
    const [title, setTitle] = useState('');
    const [severity, setSeverity] = useState<Severity | ''>('');
    const [system, setSystem] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = title.trim();
        const next: FieldErrors = {};
        if (!trimmed) next.title = 'Give the room a title';
        if (!severity) next.severity = 'Choose a severity';
        if (!system) next.system = 'Choose the affected system';
        setErrors(next);
        if (Object.keys(next).length > 0 || !severity) return;

        setSubmitting(true);
        setSubmitError(null);
        try {
            const incident = await createIncident({ title: trimmed, severity, affected_system: system });
            onCreated(incident);
        } catch (error) {
            setSubmitError(error instanceof ApiError ? error.message : 'Could not create the room. Try again.');
            setSubmitting(false);
        }
    }

    return (
        <form className="create-room" onSubmit={handleSubmit} noValidate>
            <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VPN drops every few minutes"
                error={errors.title}
                autoComplete="off"
            />
            <Select
                label="Severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                placeholder="Choose severity"
                options={SEVERITIES.map((value) => ({ value, label: SEVERITY_LABEL[value] }))}
                error={errors.severity}
            />
            <Select
                label="Affected system"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="Choose a system"
                options={AFFECTED_SYSTEMS.map((value) => ({ value, label: value }))}
                hint="Used to flag the teammate who knows this code best."
                error={errors.system}
            />

            {submitError && (
                <p className="create-room__error" role="alert">
                    {submitError}
                </p>
            )}

            <div className="create-room__actions">
                <Button variant="secondary" onClick={onCancel} disabled={submitting}>
                    Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                    Create room
                </Button>
            </div>
        </form>
    );
}
