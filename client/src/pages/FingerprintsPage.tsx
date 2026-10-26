import { useEffect, useState } from 'react';
import type { FormEvent, JSX, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, listFingerprints } from '../api';
import type { FingerprintWithPublisher } from '../api';
import { Button, EmptyState, ErrorState, Input, LiveDot } from '../components/ui';
import type { LiveState } from '../components/ui';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import './FingerprintsPage.css';

// the project id the agent publishes under by default (agent/.env.example AGENT_PROJECT_ID)
const DEFAULT_PROJECT = 'incidentiq';
const HASH_PREVIEW = 12;

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; fingerprints: FingerprintWithPublisher[] };

type Field = {
    key: string;
    label: string;
    // what gets compared; arrays are sorted first, so order alone is never a difference
    value: (fp: FingerprintWithPublisher) => string | null;
    render: (fp: FingerprintWithPublisher, baseline: FingerprintWithPublisher) => ReactNode;
};

// a fingerprint older than a day may describe a machine that has since changed
const FRESH_FOR_MS = 24 * 60 * 60 * 1000;

/**
 * How much to trust this machine's row: missing data first (a null field can't be compared), then age.
 * The agent republishes when the environment changes, so "stale" means "not seen lately", not "wrong".
 */
export function freshness(fp: FingerprintWithPublisher, now = Date.now()): { state: LiveState; label: string } {
    const missing = fp.node_version === null || fp.os_arch === null || fp.lockfile_hash === null || fp.applied_migrations === null;
    if (missing) return { state: 'failing', label: 'Missing data' };
    if (now - new Date(fp.updated_at).getTime() < FRESH_FOR_MS) return { state: 'live', label: 'Fresh' };
    return { state: 'idle', label: 'Stale' };
}

const sortedMigrations = (fp: FingerprintWithPublisher) => [...(fp.applied_migrations ?? [])].sort();

const FIELDS: Field[] = [
    {
        key: 'node',
        label: 'Node version',
        value: (fp) => fp.node_version,
        render: (fp) => <Mono value={fp.node_version} />,
    },
    {
        key: 'os',
        label: 'OS / arch',
        value: (fp) => fp.os_arch,
        render: (fp) => <Mono value={fp.os_arch} />,
    },
    {
        key: 'lockfile',
        label: 'Lockfile hash',
        value: (fp) => fp.lockfile_hash,
        render: (fp) => <Hash value={fp.lockfile_hash} />,
    },
    {
        key: 'migrations',
        label: 'Applied migrations',
        value: (fp) => (fp.applied_migrations === null ? null : JSON.stringify(sortedMigrations(fp))),
        render: (fp, baseline) => <Migrations fp={fp} baseline={baseline} />,
    },
];

/**
 * FingerprintsPage — "works on my machine", answered. Every machine that published for a project is
 * a card, side by side, under one verdict line that names what differs (build-plan.md's demo closer).
 * Each card lists the same fields in the same order, so a difference reads straight across, and a
 * value that differs from the first machine (the baseline) is marked on that machine's card.
 * Read-only: publishing is the agent's job (api/fingerprints.ts).
 */
export default function FingerprintsPage(): JSX.Element {
    const [params, setParams] = useSearchParams();
    // in the URL so a comparison can be linked and survives a reload
    const project = params.get('project')?.trim() || DEFAULT_PROJECT;
    const [draft, setDraft] = useState(project);
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        listFingerprints(project).then(
            (fingerprints) => !cancelled && setState({ status: 'ready', fingerprints }),
            (error) =>
                !cancelled &&
                setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong.' }),
        );
        return () => {
            cancelled = true;
        };
    }, [project, attempt]);

    function handleCompare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const next = draft.trim();
        if (next) setParams({ project: next });
    }

    return (
        <div className="fp-page">
            <header className="fp-page__header">
                <div>
                    <h1 className="fp-page__title">Fingerprints</h1>
                    <p className="fp-page__subtitle">Every teammate's machine for one project, side by side.</p>
                </div>
                <form className="fp-page__project" onSubmit={handleCompare}>
                    <Input label="Project" mono value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <Button type="submit" variant="secondary">
                        Compare
                    </Button>
                </form>
            </header>

            {state.status === 'loading' && (
                <div className="fp-skeleton" role="status" aria-label="Loading fingerprints">
                    <span />
                    <span />
                </div>
            )}

            {state.status === 'error' && (
                <ErrorState title="Couldn't load fingerprints" body={state.message} retry={() => setAttempt((n) => n + 1)} />
            )}

            {state.status === 'ready' && <Comparison project={project} fingerprints={state.fingerprints} />}
        </div>
    );
}

function Comparison({ project, fingerprints }: { project: string; fingerprints: FingerprintWithPublisher[] }): JSX.Element {
    if (fingerprints.length === 0) {
        return (
            <EmptyState
                title="Nobody has published for this project yet"
                body={`Run the agent with AGENT_PROJECT_ID=${project} on each machine and its fingerprint shows up here.`}
            />
        );
    }

    const baseline = fingerprints[0]!;
    const differing = FIELDS.filter((f) => fingerprints.some((fp) => f.value(fp) !== f.value(baseline)));
    const verdict =
        fingerprints.length === 1 ? 'single' : differing.length === 0 ? 'match' : 'differ';

    return (
        <section className="fp-comparison" aria-labelledby="fp-summary">
            <p id="fp-summary" className={`fp-verdict fp-verdict--${verdict}`} role="status">
                {verdict === 'single'
                    ? 'Only one machine has published, so there is nothing to compare yet.'
                    : verdict === 'match'
                      ? `All ${fingerprints.length} machines match.`
                      : `${differing.length} of ${FIELDS.length} fields differ across ${fingerprints.length} machines: ${differing.map((f) => f.label).join(', ')}.`}
            </p>
            <div className="fp-machines">
                {fingerprints.map((fp, i) => (
                    <MachineCard key={fp.id} fp={fp} baseline={baseline} isBaseline={i === 0} />
                ))}
                {fingerprints.length === 1 && (
                    <div className="fp-machine fp-machine--next">
                        <p className="fp-machine__next-title">Add a second machine</p>
                        <p className="fp-machine__next-body">
                            Run the agent with <code className="fp-mono">AGENT_PROJECT_ID={project}</code> on a teammate's machine. It shows up here, compared against this one.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

// the publisher's initials, from the part of the email before the @
function initials(email: string): string {
    const name = email.split('@')[0] ?? email;
    const parts = name.split(/[._-]+/).filter(Boolean);
    return ((parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)) || '?').toUpperCase();
}

function MachineCard({ fp, baseline, isBaseline }: { fp: FingerprintWithPublisher; baseline: FingerprintWithPublisher; isBaseline: boolean }): JSX.Element {
    const { state, label } = freshness(fp);
    return (
        <article className={`fp-machine${isBaseline ? ' fp-machine--baseline' : ''}`} aria-label={fp.published_by} data-spotlight>
            <header className="fp-machine__head">
                <span className="fp-machine__avatar" aria-hidden="true">
                    {initials(fp.published_by)}
                </span>
                <span className="fp-machine__who">
                    <span className="fp-machine__email" title={fp.published_by}>
                        {fp.published_by}
                    </span>
                    <span className="fp-machine__when">
                        <LiveDot state={state} label={label} />
                        <span>published {formatRelativeTime(fp.updated_at)}</span>
                    </span>
                </span>
                {isBaseline && <span className="fp-machine__baseline">baseline</span>}
            </header>
            <dl className="fp-fields">
                {FIELDS.map((field) => {
                    const differs = field.value(fp) !== field.value(baseline);
                    return (
                        <div key={field.key} className={`fp-fields__row${differs ? ' fp-cell--diff' : ''}`} data-field={field.label}>
                            <dt>{field.label}</dt>
                            <dd>
                                {field.render(fp, baseline)}
                                {differs && <span className="ui-sr-only"> (differs from baseline)</span>}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </article>
    );
}

function Mono({ value }: { value: string | null }): JSX.Element {
    if (value === null) return <span className="fp-missing">not reported</span>;
    return <code className="fp-mono">{value}</code>;
}

// short by default; the full hash shows on hover (title) and on keyboard focus (CSS), and is always read in full by screen readers
function Hash({ value }: { value: string | null }): JSX.Element {
    if (value === null) return <span className="fp-missing">not reported</span>;
    if (value.length <= HASH_PREVIEW) return <code className="fp-mono">{value}</code>;
    return (
        <code className="fp-mono fp-hash" tabIndex={0} title={value}>
            <span className="fp-hash__short" aria-hidden="true">
                {value.slice(0, HASH_PREVIEW)}…
            </span>
            <span className="fp-hash__full">{value}</span>
        </code>
    );
}

// lists this machine's migrations, and names exactly which ones it is missing or has extra against the baseline
function Migrations({ fp, baseline }: { fp: FingerprintWithPublisher; baseline: FingerprintWithPublisher }): JSX.Element {
    if (fp.applied_migrations === null) return <span className="fp-missing">not reported</span>;
    const mine = sortedMigrations(fp);
    const base = new Set(baseline.applied_migrations ?? []);
    const missing = fp === baseline ? [] : [...base].filter((m) => !mine.includes(m)).sort();
    return (
        <div className="fp-migrations">
            <ul className="fp-list">
                {mine.map((m) => (
                    <li key={m} className={fp !== baseline && !base.has(m) ? 'fp-list__extra' : undefined}>
                        <code className="fp-mono">{m}</code>
                        {fp !== baseline && !base.has(m) && <span className="fp-tag">extra</span>}
                    </li>
                ))}
                {missing.map((m) => (
                    <li key={m} className="fp-list__missing">
                        <code className="fp-mono">{m}</code>
                        <span className="fp-tag">missing</span>
                    </li>
                ))}
            </ul>
            {mine.length === 0 && missing.length === 0 && <span className="fp-missing">none applied</span>}
        </div>
    );
}
