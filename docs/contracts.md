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
```
