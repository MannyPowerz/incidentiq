import { useEffect, useState } from 'react';
import type { FormEvent, JSX, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, listFingerprints } from '../api';
import type { FingerprintWithPublisher } from '../api';
import { Button, EmptyState, ErrorState, Input, Spinner, Table } from '../components/ui';
import type { TableColumn } from '../components/ui';
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
 * FingerprintsPage — "works on my machine", answered. Every machine that published for a project,
 * side by side, with each value that differs from the first machine highlighted (build-plan.md's
 * demo closer). Rows are fields and columns are machines, so a difference reads across one row.
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
                    <p className="fp-page__eyebrow">Environment</p>
                    <h1 className="fp-page__title">Fingerprints</h1>
                    <p className="fp-page__subtitle">Every teammate's machine for one project, side by side. Differences from the first machine are highlighted.</p>
                </div>
                <form className="fp-page__project" onSubmit={handleCompare}>
                    <Input label="Project" mono value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <Button type="submit" variant="secondary">
                        Compare
                    </Button>
                </form>
            </header>

            {state.status === 'loading' && (
                <div className="fp-page__loading">
                    <Spinner label="Loading fingerprints" />
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

    const columns: TableColumn<Field>[] = [
        { key: 'field', header: 'Field', width: '11rem', render: (field) => <span className="fp-field">{field.label}</span> },
        ...fingerprints.map(
            (fp, i): TableColumn<Field> => ({
                key: `fp-${fp.id}`,
                header: i === 0 ? `${fp.published_by} (baseline)` : fp.published_by,
                render: (field) => {
                    const differs = i > 0 && field.value(fp) !== field.value(baseline);
                    return (
                        <div className={`fp-cell${differs ? ' fp-cell--diff' : ''}`}>
                            {field.render(fp, baseline)}
                            {differs && <span className="ui-sr-only"> (differs from baseline)</span>}
                        </div>
                    );
                },
            }),
        ),
    ];

    return (
        <section className="fp-comparison" aria-labelledby="fp-summary">
            <p id="fp-summary" className="fp-summary" role="status">
                {fingerprints.length === 1
                    ? 'Only one machine has published, so there is nothing to compare yet.'
                    : differing.length === 0
                      ? `All ${fingerprints.length} machines match.`
                      : `${differing.length} of ${FIELDS.length} fields differ across ${fingerprints.length} machines: ${differing.map((f) => f.label).join(', ')}.`}
            </p>
            <Table caption={`Fingerprints for ${project}`} columns={columns} rows={FIELDS} rowKey={(f) => f.key} empty={null} />
            <p className="fp-published">
                {fingerprints.map((fp) => (
                    <span key={fp.id}>
                        {fp.published_by} published {formatRelativeTime(fp.updated_at)}
                    </span>
                ))}
            </p>
        </section>
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
