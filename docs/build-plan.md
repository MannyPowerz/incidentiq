# Build Plan & Shipping Tiers

Source: Resume_Project_Addendum.pdf

Every feature has three levels:

- **Minimum** — must exist for the demo to work
- **Complete** — the full MVP version
- **Post-MVP** — ships later, not this semester

The commitment: every feature reaches at least Minimum.
The spine reaches Complete. Nothing from Post-MVP enters this semester.

---

## Feature tiers

| Feature                | Minimum                                                                 | Complete                                                                   | Post-MVP                          |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| Auth & Roles           | Register, login, JWT, protected routes                                  | Refresh rotation, three roles, org workspace                               | SSO, admin console                |
| Incident Rooms         | Create, join, resolve                                                   | Full status lifecycle, archive, immutability                               | Severity automation               |
| Real-Time Timeline     | Live entries via Socket.io                                              | Typing indicators, presence, reconnection handling                         | Entry threading                   |
| AI Log Analysis        | Paste log → structured explanation                                      | Root cause + fix + storage in database                                     | Confidence scoring                |
| Search & Archive       | Search by title and keyword                                             | Filter by system, severity, date; auto-surfacing of similar past incidents | Semantic vector search            |
| Tier 1 Scanner         | Port responsiveness check + VPN demo scenario                           | All three checks: port, network interface, env variables                   | Expanded signature list           |
| Tier 2 Scanner         | Fingerprint publishing + Node version diff between two machines         | Lockfile drift + migration drift detection                                 | Git collision warnings            |
| AI Log Drafting        | AI drafts entry from scanner context, human confirms                    | Editable draft with structured format                                      | Auto-tagging, severity suggestion |
| Relevance Engine       | Flag the one most-connected teammate per post with plain English reason | Ranked relevance for all team members                                      | Full visual relevance web         |
| Personalized Interface | Relevant posts surface at top of each developer's view                  | Per-developer view with relevance explanations under each entry            | IDE plugin, mobile notifications  |

---

## Build order

### Phase 1 — The Spine (Person 1 goes first)

Auth → incident create/join → timeline entry storage → relevance → fingerprints.

Nothing in Phase 2 starts until a user can register, open a room,
collaborate live, and resolve an incident end to end.

### Phase 2 — Tier 1 Scanner + AI Drafting (Person 3)

Port check and VPN demo scenario first — this is the 60-second demo opener.
Then network interface and env variable checks.
AI drafting connects the scanner to the war room.

### Phase 3 — Tier 2 + Relevance (Person 2 + Person 1)

Fingerprint publishing, Node version diff between two machines — the demo closer.
Then the relevance engine flagging the most-connected teammate per post.

### Phase 4 — Polish and dogfood

The team uses the app while building the app.
Every real environment failure it catches becomes demo material.
Target: a number to say out loud — "it caught N real failures during our own development."

---

## The demo arc

**Open with:** VPN catch (Tier 1, 60 seconds, no setup needed)
**Close with:** works-on-my-machine diff between two laptops
(Tier 2 — the moment no other tool can replicate)

---

## The rule that protects the ship date

If any feature is at risk of missing Minimum, it borrows time from a feature
sitting above Minimum — never from the spine.

**The spine is never traded.**

---

## Minimum demo definition

The demo works when:

1. A developer's scanner catches a VPN failure
2. They post it
3. It is stored in the database
4. It broadcasts live to a teammate
5. That teammate sees it ordered by relevance

You can fake the AI draft with a template if needed.
You can show relevance with just two machines.
Do not add anything beyond this until it works end to end.
