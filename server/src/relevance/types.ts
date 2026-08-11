/**
 * types.ts — the relevance engine's contract, in code. Three people build against this file.
 *
 * The engine answers one question: of everyone on this team, who most likely cares about the thing
 * that just happened, and how much. It runs as step 8 of the flow in docs/architecture.md, after the
 * entry is already saved, and its output only ever orders a list.
 *
 * Three pieces, one owner each. They only stay parallel if this file stays still:
 *   1. collector  — shells out to git, returns CommitTouch[]
 *   2. scoring    — turns those touches into a TeammateScore per person
 *   3. reason     — turns one TeammateScore into a sentence a human reads
 *
 * Rules of the road, agreed 2026-08-11 and recorded in ADR 0011:
 *   - Additive only. Fields get added, never renamed or removed, without telling the other two.
 *   - Some data here is for DISPLAY and never touches the maths. Each one says so on its line.
 *     Scoring on it is how this gets subtly wrong, so the boundary is written down, not remembered.
 */

// ---------------------------------------------------------------------------
// 1. COLLECTOR — owned by whoever takes the git log piece
// ---------------------------------------------------------------------------

/**
 * One person touching one file in one commit. A commit that changed five files produces five of
 * these, so the collector flattens rather than nesting.
 *
 * Skip merge commits entirely. They credit whoever pressed merge with every file in the merge,
 * which inflates that person's ownership and produces a useless subject line on top of it.
 */
export interface CommitTouch {
    /**
     * The commit author's email, straight from git.
     *
     * OPEN QUESTION, nobody owns this yet: git author emails do not necessarily match users.email
     * in our database. Somebody's laptop is configured with a personal address and their touches
     * will attach to nobody. Needs deciding before this ships — see the note at the bottom.
     */
    author_email: string;

    /** Repo-relative, exactly as git prints it. */
    file_path: string;

    /** Author date, not commit date. Rebasing rewrites commit dates and would fake recency. */
    committed_at: Date;

    /**
     * DISPLAY ONLY — never a scoring input.
     *
     * The commit's subject line. It exists so a reason can say "renamed a variable" instead of just
     * "touched this file", because those two lead to different decisions about whether to go ask
     * that person. Scoring on the text would mean guessing intent from prose, which reads as clever
     * and behaves badly.
     */
    subject: string;
}

// ---------------------------------------------------------------------------
// 2. SCORING — owned by Manny
// ---------------------------------------------------------------------------

/**
 * What the engine knows about the entry it is scoring against.
 *
 * file_paths is how an entry gets connected to git history at all. For now those come from mapping
 * the incident's affected_system to a directory, since that column already exists. Later the agent
 * will report the real paths in its detection payload, which is strictly better and does not change
 * this shape — the paths just arrive from somewhere more accurate.
 */
export interface RelevanceContext {
    entry_id: number;
    incident_id: number;
    file_paths: string[];
}

/**
 * One teammate's result. This is the whole contract between scoring and reason.
 *
 * It is deliberately not a single number. The reason generator can only say what this object
 * carries, so a bare score would leave it with nothing to write but the score itself.
 *
 * Ownership outweighs recency in the weighting. In an incident, who knows the code is more useful
 * than who happened to edit it last.
 */
export interface TeammateScore {
    user_id: number;

    /** The combined figure step 10 sorts on. Only meaningful relative to other people on the same entry. */
    score: number;

    /** The parts that made the score, kept separate so the reason can name whichever one dominated. */
    signals: {
        /** How recently they touched these files, decayed so older edits fade smoothly. */
        recency: number;

        /** How often they touched them. */
        frequency: number;

        /** How much of these files' history is theirs. Weighted highest of the three. */
        ownership: number;
    };

    /**
     * DISPLAY ONLY — never a scoring input.
     *
     * The most recent thing this person actually did to these files, so the reason can be specific.
     * null when there is nothing worth saying: no touches at all, or a subject so useless
     * (wip, fix, asdf) that printing it would be worse than staying quiet.
     */
    last_touch: {
        file_path: string;
        subject: string;
        at: Date;
    } | null;
}

// ---------------------------------------------------------------------------
// 3. REASON — owned by whoever takes the reason string piece
// ---------------------------------------------------------------------------

/**
 * Takes one TeammateScore and returns the sentence shown under the entry.
 *
 * Worth knowing who this sentence is for. Step 10 of the flow orders every teammate's feed by their
 * own score, so the reader is the person being scored. The sentence answers "why is this at the top
 * of my list" or "who should I go ask", not "here is a statistic about somebody".
 *
 * Which means a good one names an action or a person. "You changed this file yesterday" works.
 * "Gabby wrote most of this and last touched it three weeks ago" works. "Score 0.82" does not.
 *
 * Cases that need an answer, not just the happy path:
 *   - every score is zero, because nobody has touched anything relevant
 *   - last_touch is null, so there is no specific change to describe
 *   - two people score nearly the same
 */
export type ReasonFor = (score: TeammateScore) => string;

// ---------------------------------------------------------------------------
// UNOWNED — decide before this ships
// ---------------------------------------------------------------------------

// 1. Git author email to users.email. Nothing guarantees they match, and a mismatch silently drops
//    that person from every score rather than erroring. Whoever hits it first should raise it.
// 2. What the UI shows when every score is zero. It is a real answer, not a bug, and the reason
//    generator needs a sentence for it.
