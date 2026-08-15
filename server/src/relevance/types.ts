/**
 * types.ts — the relevance engine's contract. Three people build against this file.
 *
 * The engine answers: of everyone on this team, who most likely cares about what just happened.
 * Runs as step 8 in docs/architecture.md, after the entry is saved. Its output only orders a list.
 *
 *   1. collector (Gabriella) — git log -> CommitTouch[]        <- critical path, both others read it
 *   2. scoring   (Manny)     — touches -> TeammateScore each
 *   3. reason    (Anthony)   — one TeammateScore -> a sentence
 *
 * Nobody is blocked: 2 and 3 take their input as arguments, so a fixture is enough to build against.
 *
 * Two rules, from ADR 0011:
 *   - Additive only. Add fields, never rename or remove, without telling the other two.
 *   - Fields marked DISPLAY ONLY never touch the maths. Scoring on them is how this goes subtly wrong.
 */

// --- 1. COLLECTOR (Gabriella) ----------------------------------------------

/**
 * One person, one file, one commit. A commit touching five files makes five of these.
 * Skip merge commits: they credit the merger with every file and inflate ownership.
 */
export interface CommitTouch {
    /** Straight from git. See open question 1 at the bottom — these may not match users.email. */
    author_email: string;

    /** Repo-relative, as git prints it. */
    file_path: string;

    /** Author date, not commit date. Rebasing rewrites commit dates and would fake recency. */
    committed_at: Date;

    /**
     * DISPLAY ONLY. The commit subject, so a reason can say "renamed a variable" rather than
     * "touched this file" — different answers to whether it's worth interrupting someone.
     */
    subject: string;
}

// --- 2. SCORING (Manny) -----------------------------------------------------

/** What we know about the entry being scored. */
export interface RelevanceContext {
    entry_id: number;
    incident_id: number;

    /** From mapping the incident's affected_system to a directory for now; agent-reported later. */
    file_paths: string[];
}

/**
 * One team member, and the bridge between the two halves of this file: CommitTouch knows people by
 * email, TeammateScore knows them by user_id, and nothing else connects the two.
 *
 * A plain array rather than a Map or a lookup function, because everything else here is data the
 * server could serialize and send elsewhere — architecture.md calls relevance a stateless helper,
 * and a Map or a closure could not survive that becoming literally true.
 *
 * The email must be the one git reports after .mailmap is applied, not whatever is on the account.
 * That is what makes a laptop configured with a personal address still resolve to the right person.
 */
export interface TeamMember {
    user_id: number;
    email: string;
}

/**
 * One teammate's result, and the whole contract between scoring and reason.
 * Not a single number: the reason can only say what this carries.
 */
export interface TeammateScore {
    user_id: number;

    /** What step 10 sorts on. Only meaningful against other people on the same entry. */
    score: number;

    /**
     * Kept separate so the reason can name whichever one dominated.
     * Each is brought onto a 0..1 scale before the weights are applied, so they can be compared.
     */
    signals: {
        recency: number;

        /**
         * How much they have been on these files lately: commits inside a recent window, over a cap.
         * Above the cap everyone ties at 1, on purpose — 12 commits and 40 both just mean "a lot",
         * and nothing downstream does anything different with the gap between them.
         * Windowed and absolute, where ownership is all-time and a share. A share of the team's
         * total here would be ownership under a second name, and then two of the three signals
         * could never disagree, which is the whole reason there are three.
         */
        frequency: number;

        /** Weighted highest: in an incident, who knows the code beats who edited it last. */
        ownership: number;
    };

    /**
     * DISPLAY ONLY. The last thing they actually did to these files.
     *
     * null means one thing and nothing else: they have no touches here. A useless subject like
     * "wip" or "asdf" still arrives populated, because deciding it is not worth showing is a call
     * about the finished sentence, and Anthony is the only one who can see the finished sentence.
     */
    last_touch: {
        file_path: string;
        subject: string;
        at: Date;
    } | null;
}

// --- 3. REASON (Anthony) ----------------------------------------------------

/**
 * One TeammateScore -> the sentence shown under the entry.
 *
 * The reader is the person being scored, since step 10 orders each teammate's own feed. So it
 * answers "why am I seeing this" or "who do I ask". "You changed this yesterday" works.
 * "Score 0.82" does not.
 *
 * Needs an answer for: every score zero, last_touch null, and two people scoring nearly the same.
 */
export type ReasonFor = (score: TeammateScore) => string;

// --- UNOWNED — decide before shipping ---------------------------------------

// 1. Git author emails may not match users.email. A mismatch silently drops that person from every
//    score rather than erroring. Whoever hits it first, raise it.
// 2. What the UI shows when every score is zero. A real answer, not a bug — the reason needs a line for it.
