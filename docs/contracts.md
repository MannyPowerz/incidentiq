# Contracts — Inter-Person Handoffs

The rule everything is built around:
**The scanner observes. The human decides. The database remembers. The socket delivers.**

---

## Person 3 → Person 1 (REST)

When a developer clicks "post to war room", Person 3 sends:

POST /api/incidents/:incidentId/entries

```json
{
  "signature_id": "VPN_LOOPBACK",
  "detection_payload": {},
  "intent": "Running npm run dev",
  "environment_snapshot": {
    "active_interfaces": [],
    "bound_ports": []
  }
}
```

Person 3 waits for the response:

- Success → dismiss the private card
- Error → keep the card, show retry option

---

## Person 1 → AI Service (internal)

Person 1 calls the AI after validating the post.
Input: signature_id, environment_snapshot, intent
Output (Zod validated):

```json
{
  "summary": "",
  "why_it_matters": "",
  "likely_fix": ""
}
```

If validation fails → retry once → fall back to signature.explain() text.
AI output is NEVER trusted without schema validation.

---

## Person 1 → Person 2 (internal function call)

After the database write succeeds, Person 1 calls Person 2's broadcast
function directly (same Node process):

```js
broadcastToRoom(incidentId, "entry:new", package);
```

Person 2 does NOT validate, transform, or store — that already happened.

---

## Person 2 → Person 3 (Socket.io)

Person 2 emits to the incident room:

```js
io.to(`incident:${incidentId}`).emit("entry:new", package);
```

The package shape Person 3 should expect:

```json
{
  "entry": {
    "id": "",
    "incident_id": "",
    "author_id": "",
    "author_name": "",
    "content": {
      "summary": "",
      "why_it_matters": "",
      "likely_fix": ""
    },
    "signature_id": "",
    "created_at": "",
    "locked": false
  },
  "relevance": {
    "[userId]": {
      "score": 0.92,
      "reason": "Connects to your Vite config changes this morning"
    }
  },
  "past_solutions": [
    {
      "incident_id": "",
      "signature_id": "",
      "summary": "",
      "resolved_at": ""
    }
  ]
}
```

---

## Person 3 → Person 1 (fingerprint, periodic)

Sent on scanner start, when package-lock.json changes, when migrations folder changes.
NOT sent on every loop.

PUT /api/fingerprints

```json
{
  "node_version": "",
  "os_arch": "",
  "lockfile_hash": "",
  "applied_migrations": []
}
```

---

## Person 3 → Person 1 (fingerprint fetch, Tier 2)

When a Tier 2 signature needs peer data:

GET /api/fingerprints?project=<id>

Returns all teammate fingerprints for that project.
The signature does the comparison locally on Person 3's machine.

---

## Failure modes — agreed behavior

| Failure                  | Who handles it | What happens                                                          |
| ------------------------ | -------------- | --------------------------------------------------------------------- |
| API call fails (P3 → P1) | Person 3       | Show retry, keep private card                                         |
| DB write fails (P1)      | Person 1       | Return error, do NOT broadcast                                        |
| AI times out (P1)        | Person 1       | Fall back to raw detection or manual entry                            |
| Socket missed by client  | Person 2/3     | Client refetches gap from DB on reconnect                             |
| Browser closed mid-post  | Nobody         | If stored = truth, broadcasts normally. If not stored = gone, re-post |
