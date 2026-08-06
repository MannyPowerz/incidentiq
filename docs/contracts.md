# Contracts — Inter-Person Handoffs
<!-- Ported from Description___Roles.pdf -->
<!-- Defines exact API payloads between Person 1, 2, and 3 -->

## Fingerprints

The machine fingerprint is the environment snapshot Tier 2 signatures diff
against: one row per (user, project), republished by the local agent whenever
the environment it describes changes.

Mounted at `/fingerprints` (no `/api` prefix — matches the existing `/auth`,
`/incidents`, and `/incidents/:id/timeline` mounts; the `/api/fingerprints`
in ADR 0003 and migration 0004 predates those routes).

Both endpoints require `Authorization: Bearer <accessToken>`. Identity comes
from the token, never the body — the publishing user is `sub`, the org is
`org_id`.

### PUT /fingerprints

Publish or republish this user's fingerprint for one project. Idempotent: the
same body sent twice leaves the same single row.

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `project_id` | string, non-empty | yes | Bare identifier, no projects table backs it |
| `node_version` | string | no | e.g. `"22.11.0"` |
| `os_arch` | string | no | e.g. `"darwin-arm64"` |
| `lockfile_hash` | string | no | Hash of the lockfile, not its contents |
| `applied_migrations` | array | no | Stored as JSONB; MIGRATION_DRIFT compares inside it |

```json
{
  "project_id": "incidentiq",
  "node_version": "22.11.0",
  "os_arch": "darwin-arm64",
  "lockfile_hash": "sha256:9f2c...",
  "applied_migrations": ["0001_tenancy", "0002_incidents_timeline"]
}
```

**Full replace, not merge.** The body is the whole snapshot. An omitted
optional field is stored as `null`, overwriting whatever was there. The agent
is expected to send everything it knows on every publish.

The reason is that this row is what Tier 2 diffs *against*. A field that
quietly kept its previous value would make the row a blend of several points
in time, and the resulting diff would be wrong in a way nothing surfaces. A
`null` is visibly missing; a stale value is invisibly false. If partial
publishing is ever genuinely needed, it arrives as a separate `PATCH`, not by
loosening this.

**Response — 200**

Always 200, whether the row was created or updated. `PUT` states an intent
("this row should be this"), and the caller has no use for which branch the
upsert took.

```json
{
  "fingerprint": {
    "id": 1,
    "user_id": 3,
    "project_id": "incidentiq",
    "node_version": "22.11.0",
    "os_arch": "darwin-arm64",
    "lockfile_hash": "sha256:9f2c...",
    "applied_migrations": ["0001_tenancy", "0002_incidents_timeline"],
    "updated_at": "2026-08-04T18:20:00.000Z"
  }
}
```

`updated_at` is refreshed on every successful publish, including republishes
that change nothing. There is no database trigger doing this — ADR 0003
records it as a deliberate app-layer obligation, so the write sets it
explicitly.

**Errors**

| Status | `error` | When |
|---|---|---|
| 400 | `Bad Request` | Body fails the schema (missing or empty `project_id`, wrong types) |
| 401 | `token_missing` / `token_expired` / `token_invalid` | Standard `requireAuth` responses |

### GET /fingerprints?project=<project_id>

Read every fingerprint published for one project by anyone in the caller's
org. This is what makes a two-machine comparison possible: node version,
lockfile hash, and applied migrations side by side across teammates.

**Query params**

| Param | Required | Notes |
|---|---|---|
| `project` | yes | 400 if absent or empty |

**Response — 200**

Always an array, ordered by `user_id`. An empty array is a valid answer and
means nobody in the org has published for that project — not a 404, because
the project itself is not a resource this API owns.

Each row carries `published_by`, the email of the user who published it. The
org filter already joins `users`, so this costs nothing extra to return, and a
comparison between two machines is not readable without it — `user_id: 7`
tells a person nothing about whose environment differs.

```json
{
  "fingerprints": [
    {
      "id": 1,
      "user_id": 3,
      "published_by": "manny@example.com",
      "project_id": "incidentiq",
      "node_version": "22.11.0",
      "os_arch": "darwin-arm64",
      "lockfile_hash": "sha256:9f2c...",
      "applied_migrations": ["0001_tenancy", "0002_incidents_timeline"],
      "updated_at": "2026-08-04T18:20:00.000Z"
    },
    {
      "id": 2,
      "user_id": 7,
      "published_by": "anthony@example.com",
      "project_id": "incidentiq",
      "node_version": "20.18.1",
      "os_arch": "linux-x64",
      "lockfile_hash": "sha256:41ab...",
      "applied_migrations": ["0001_tenancy"],
      "updated_at": "2026-08-03T14:02:00.000Z"
    }
  ]
}
```

`PUT` returns the bare row with no `published_by` — the caller published it,
so it already knows.

**Org scoping.** `machine_fingerprints` has no `org_id` column, so unlike
every other query module the tenant boundary is not a `WHERE org_id = $1` on
the table itself. It is enforced by joining `users` and filtering on that
user's `org_id`. A caller can never read a fingerprint belonging to another
org, but the filter lives one table over — worth knowing before reading the
query and concluding the check is missing.

**Errors**

| Status | `error` | When |
|---|---|---|
| 400 | `project_required` | `?project=` absent or empty |
| 401 | `token_missing` / `token_expired` / `token_invalid` | Standard `requireAuth` responses |
