/**
 * systemPaths.ts — an incident's affected_system, turned into the directories the relevance
 * engine should score. ADR 0011's stopgap for connecting an entry to files before the agent
 * reports real paths.
 *
 * Hand-maintained on purpose (ADR 0011): a repo whose layout still moves — four Socket files
 * moved in one week during this project — will make any map go stale. Keeping the map in one
 * small file with this comment is the accepted cost, not a bug to eventually fix.
 *
 * A gap this file does not solve: affected_system is free TEXT with no enum and no CHECK
 * (migration 0002), so a human can type anything at incident-creation time. This map only fires
 * when what they typed happens to match a key below. The one real value seen anywhere in this
 * repo is 'postgres', in a test fixture. Closing that gap means either constraining
 * affected_system to a known set or fuzzy-matching free text, and both are product decisions
 * that belong with whoever owns incident creation, not a default reached for here.
 */

const SYSTEM_TO_PATHS: Record<string, string[]> = {
    auth: ['server/src/auth'],
    timeline: ['server/src/timeline'],
    incidents: ['server/src/incidents'],
    fingerprints: ['server/src/fingerprints'],
    relevance: ['server/src/relevance'],
    sockets: ['server/src/Socket'],
    // the one value actually used anywhere in this repo today (incidents.smoke.test.ts)
    postgres: ['server/src/db'],
    database: ['server/src/db'],
    // added for the agent's port -> system mapping (agent-architecture.md §10): a dead port on
    // -> 5173 or 3000 needs a system name the agent can put in Detection.affectedSystem, and it
    // -> has to be a key here or the incident it creates scores nobody.
    client: ['client/src'],
    server: ['server/src']
};

/**
 * null and unmatched names both return []. An incident with no useful system name should score
 * nobody rather than throw, same as scoreTeammates already does with an empty touches array.
 */
export function resolveFilePaths(affectedSystem: string | null): string[] {
    if (affectedSystem === null) return [];

    return SYSTEM_TO_PATHS[affectedSystem.trim().toLowerCase()] ?? [];
}
