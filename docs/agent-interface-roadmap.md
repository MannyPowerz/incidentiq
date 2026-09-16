# The Agent Interface — CLI Today, and What It Becomes After the MVP

**Status:** the CLI is designed, not built. Everything past Stage 1 is a plan, not a commitment.
**Companions:** `agent-architecture.md` (the design), `schedule.md` (`Agent browser view`, deferred), `architecture.md` (the governing rule)

---

## Today: a terminal, deliberately

The agent has no browser interface at all. When a signature fires, the developer
sees a box drawn in their own terminal and answers a single prompt:

```
┌─ IncidentIQ ── VPN_LOOPBACK ── critical ────────────────────────┐
│  Port 5173 is bound but not responding, and a tunnel interface  │
│  (utun3) is active. A VPN is likely capturing loopback traffic. │
│                                                                   │
│  Nothing has been sent. Post this to the war room?  [y/N]       │
└───────────────────────────────────────────────────────────────────┘
```

Default is **No**. Pressing Enter posts nothing.

That prompt is `readline` from the Node standard library — no framework, no
server round trip, no page. The reasoning is recorded in
`agent-architecture.md` §3, but the short version is that the human gate is the
product's core rule made physical, and a terminal prompt proves a person was
present in a way a background process never can. A browser UI would also mean a
new endpoint, new client wiring, and a new trust boundary, for something the
demo does not need.

**One consequence worth stating plainly:** until a human approves a detection,
nothing about it exists outside that laptop. That is not a missing feature. It
is the design — `architecture.md`'s first rule is *"the agent detects, the human
decides,"* and a detection nobody approved has not been decided on yet.

---

## Stage 1 — Detections become visible

**Trigger:** the agent starts writing to `signatures_detected`.

That table has existed since migration 0004 with full constraints, foreign
keys, and a tier CHECK — and **no code reads or writes it** (confirmed in
`technical-audit.md` §4.5). Every firing currently vanishes the moment the card
is answered, approved or not.

Stage 1 is the agent inserting a row per firing, then a **read-only page** in
the existing React client listing them. Recent detections, which signature,
which machine, whether it was posted.

**Why this comes first:** it is purely additive, needs no new trust boundary,
and it converts "the agent caught something" from an anecdote into a number.
`build-plan.md`'s Phase 4 target is literally *"a number to say out loud — it
caught N real failures during our own development."* That number cannot be
counted until something stores the firings.

---

## Stage 2 — Live, using infrastructure that already exists

Once detections are rows, showing them live needs no new mechanism. Socket.io
rooms already do exactly this for timeline entries: write to Postgres, then
broadcast. A detection lands, the socket pushes, the page updates.

No new dependency, no polling, no second real-time system. This stage is small
precisely *because* Stage 1 did the unglamorous part first.

---

## Stage 3 — More signatures, unchanged engine

The MVP ships one signature, `VPN_LOOPBACK`. The rest were scoped out rather
than forgotten:

| Tier | Remaining |
|---|---|
| Tier 1 | `ENV_VAR_MISSING`, `PORT_COLLISION` |
| Tier 2 | `NODE_VERSION_DRIFT`, `LOCKFILE_DRIFT`, `MIGRATION_DRIFT` |

Each is one new file implementing the `Signature` interface. **The engine never
changes** — it is a loop over a registry array. That open/closed shape is also
why interface work and signature work never block each other: Stages 1 and 2
can ship with one signature, and new signatures can ship with no interface
changes.

Also here: **chokidar replaces interval scanning.** The MVP scans every 30
seconds; watching `package-lock.json` and the migrations folder is a refinement
of *when* to scan, not *what* a scan finds.

---

## The decision to make before Stage 4, not during it

The obvious next step after a read-only page is a **configurable** one — toggle
which signatures are active, change the scan interval, all from the browser.

That step is a bigger change than it looks. Today the person controlling the
agent is sitting at the machine being watched, and `ADR 0016` scoped the
agent's credential around what the agent *sends outward*. A browser that can
change agent behaviour over the network inverts that: the machine now accepts
instructions from the network, and a stolen session could silence a detector on
someone else's laptop.

**This needs its own ADR before anyone writes it.** Stages 1 through 3 are all
read-only or local and do not touch this boundary; control does. Worth naming
now so it is a deliberate decision later rather than a feature that slides in
because it seemed like the natural next iteration.

---

## What stays true at every stage

**Nothing auto-posts.** Whatever the interface grows into, a detection reaches
the war room only when a human says so. Every stage above changes what a person
can *see*; none of them change who decides.
