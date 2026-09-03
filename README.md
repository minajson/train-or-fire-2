# Train or Fire — The Warning Signs

A live decision experience for a hybrid HSE session. A critical machine has
failed. Four roles were involved. The room decides, one role at a time, whether
to **train** or **fire** each of them — and then discovers what that decision
actually fixed.

The activity is built around one turn. It spends its first half inviting
judgement and its second half examining it, moving the conversation from *"who
should we fire?"* to *"what actually allowed the failure?"*.

No personal names appear anywhere. The four subjects are job roles.

---

## Running it

```bash
npm install
npm run dev
```

Then, on the facilitator's own machine:

1. Open `http://localhost:3000` and press **Start a session**.
   You land on the facilitator console at `/host/<code>` and the control token
   is written to that browser's local storage. It is never put in a URL, so
   opening `/host/<code>` on any other device shows a polite refusal.
2. Press **Open projector ↗** and drag that window to the projector.
3. Participants scan the code on the join screen, or type it at `/join`.

For a live event on a real network, use the production build:

```bash
npm run build
npm start
```

Participants need to reach the host machine, so bind it to a LAN address
(`npm start -- -H 0.0.0.0`) and open the projector at that address rather than
at `localhost` — with no `NEXT_PUBLIC_APP_URL` set, the QR encodes whatever
origin the projector page was loaded from. The facilitator console warns when
that origin is one nobody outside the machine can reach. For a real event,
deploy instead: see [Deployment](#deployment).

### Rehearsing alone

**Add 30 simulated** on the console fills the session with believable votes for
every question, so the whole activity — including the verdict board and both
AAR polls — can be walked through without an audience. Simulated participants
are flagged and removable in one click. The weights are deliberately chosen to
produce a *mixed* board (two trained, two fired), because a rehearsal that
lands all four on one side would never show the layout a real room produces.

---

## The three surfaces

| Surface | Route | For |
| --- | --- | --- |
| Projector | `/present/<code>` | The room. Full-bleed, never scrolls, no chrome. |
| Participant | `/j/<code>` | Phones. One decision, two enormous controls. |
| Facilitator | `/host/<code>` | The console: transport, live counts, private notes. |

All three read the same live state over one SSE connection each, so they cannot
drift apart.

### Facilitator keys

A presentation remote sends arrow keys, so the whole activity can be driven
without looking at the console:

| Key | Action |
| --- | --- |
| `→` / `PageDown` | Next beat, then next stage |
| `←` / `PageUp` | Back |
| `R` | Reveal |
| `L` / `U` | Lock / unlock voting |
| `Q` / `Esc` | Raise / lower the full-screen join code |

---

## How the activity is modelled

Two ideas carry the whole thing, both defined in
[`src/lib/content/activity.ts`](src/lib/content/activity.ts):

- A **stage** is one screen on the projector. There are 23, grouped into
  chapters (Open · The decision · The turn · Rewind · Learn · Cost · Close).
- A **beat** is progressive disclosure *within* a stage. The incident, the
  failure chain, the cost list and the system question all build one line at a
  time, and the facilitator drives that with the same Next key.

`next` walks beats first and stages second; `back` returns to the *last* beat of
the previous stage, so a chain you have already built comes back built.

Nothing in `next`/`back`/`goto` touches votes or revealed phases, which is what
makes the facilitator's Back button safe mid-session.

Adding or reordering a stage means editing that one file. Nothing in the store,
transport, or control layers needs to change.

### The board

The TRAIN/FIRE board is **derived on every read** from the votes themselves
(`src/lib/engine/board.ts`), never stored. A role appears on it only once its
own question has been revealed. That is what lets the board build up across the
four decisions and survive any amount of navigating backwards and forwards.

### What is withheld, and when

The single most important withholding in the app: **until the facilitator
reveals, no client receives the split.** Not the projector, not a phone. The
projector can show `24 / 31 decided` because that comes from participant counts,
which carry no information about which way anyone voted.

The facilitator's own state adds a `preview` field with the unrevealed split, so
they can decide how to frame what is about to go on the wall. Public state never
has it.

---

## Architecture

The realtime and session layer follows the proven Team Pulse design — a store
that serialises writes per session, a hub that fans one read out to every open
screen, and SSE consumed with `fetch` rather than `EventSource` so credentials
travel in headers instead of URLs.

```
 phone ─┐
 phone ─┼─► /api/sessions/[code]/vote ──┐
 phone ─┘                               │
                                        ▼
 console ─► /api/sessions/[code]/control ──►  service  ──►  store
                                                              │
                                                     "code changed"
                                                              ▼
 projector ◄─ SSE ─┐                                         hub
 phone     ◄─ SSE ─┼──────────  /api/sessions/[code]/stream ──┘
 console   ◄─ SSE ─┘
```

| Layer | File | Note |
| --- | --- | --- |
| Content | `lib/content/activity.ts` | Stages, roles, chain, notes. The script. |
| Store | `lib/store/{memory,postgres}.ts` | One `SessionStore` seam; snapshot locally, jsonb row in production. |
| Fan-out | `lib/realtime/hub.ts` | One read per change, 60ms coalescing. |
| Rules | `lib/session/service.ts` | Join, vote, every control command. |
| Derivation | `lib/engine/{tally,board,state}.ts` | Public vs facilitator state. |
| Transport | `app/api/sessions/[code]/stream` | SSE with keepalive and retry hint. |
| Client | `lib/client/{stream,useSession}.ts` | Backoff, wake-on-visible, revision guard. |

### Persistence

The store is chosen by one thing: whether `TRAIN_FIRE_DATABASE_URL` is set.

**Development (unset).** The authoritative copy lives in process memory and is
snapshotted to `.data/sessions.json` (write-then-rename, so a crash mid-write
cannot truncate it). Zero setup, and restarting the server mid-session restores
the stage, the beat, every phase, every participant and every vote.

**Production (set).** The Postgres driver takes over. On a multi-instance host
this is not optional: without it every instance runs its own private, divergent
copy of the room, and which one a participant reaches is down to load balancing.

The session is one jsonb row. It is a small, hot document that is always read
and written whole, so normalising it across tables would buy nothing and cost a
join on every broadcast. `revision` and `status` are stored generated columns,
which is what makes the cross-instance poll below a bare index lookup.

Two production problems, and how the driver answers them:

| Problem | Answer |
| --- | --- |
| Two people vote in the same millisecond | `SELECT … FOR UPDATE` inside a transaction. The second transaction blocks on the row, reads the first vote, and adds to it. |
| The voter's instance is not the projector's instance | `LISTEN/NOTIFY` for speed, plus a revision poll scoped to the codes this instance has screens open for. Correctness comes from the poll; NOTIFY only makes it instant. |

That second row is the part worth being careful about. `LISTEN` needs a
session-mode connection and a **transaction-mode pooler drops it silently** —
no error, just a projector that never updates. So the hub tells the driver which
codes it is serving (`SessionStore.setActiveCodes`) and the driver polls exactly
those, by primary key, reading only the revision. One index lookup per open
session per tick, whether or not NOTIFY is working.

`GET /api/health` reports which driver is live and whether `LISTEN` is
connected. It deliberately reveals nothing about *which* database.

The schema is inlined in `src/lib/store/schema.ts` rather than read from a
`.sql` file at runtime, because on Vercel the source tree is not in the
serverless bundle — a driver that reads its own schema off disk boots fine
locally and throws `ENOENT` the first time production touches the database.

---

## Deployment

```bash
vercel link            # project: train-or-fire-2
vercel env add TRAIN_FIRE_DATABASE_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel deploy --prod
```

| Variable | Scope | Why |
| --- | --- | --- |
| `TRAIN_FIRE_DATABASE_URL` | Production, **server only** | The source of truth. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | Production only | What the join QR encodes. Leave unset locally and on previews so each points at itself. |

### What the QR encodes

`src/lib/client/app-url.ts` resolves the join origin as `NEXT_PUBLIC_APP_URL`
when set and parseable, otherwise the origin the page was loaded from. The QR
contains `<origin>/j/<code>` and nothing else — no facilitator token, no
participant secret, no query string.

Setting the canonical URL on the production environment only is deliberate: it
stops a projector opened on a preview deployment, a LAN address, or `localhost`
from displaying a QR that scans perfectly and opens nothing. When the resolved
origin is not publicly reachable, the facilitator console says so in plain text
rather than letting it be discovered thirty seconds into a live session.

### Security

- The facilitator token is 32 hex characters, compared in constant time, and
  lives only in the creating browser's local storage.
- Each participant gets a secret at join, held only by the server and that one
  device. It proves "this vote is mine" without identifying who cast it.
- Public state has been asserted in tests to contain no token, no participants
  array, no responses array, and no facilitator preview.
- Sliding-window rate limits on create, join, vote and control, sized for a room
  full of phones behind one office NAT.

---

## Accessibility

- TRAIN and FIRE never rely on colour. Both always carry the **word** and a
  distinct **silhouette** — an upward arrow for train, a cross for fire — on
  every surface, plus `aria-pressed` on the phone controls.
- Projector type is sized against both axes (`min(vw, vh)`), so 1366×768 — where
  height is the binding constraint — cannot produce a headline that fits the
  width but pushes the rest of the stage off screen.
- Every ink step clears 4.5:1 on the paper background; white on train and white
  on fire clear 6.0:1 and 5.2:1.
- `prefers-reduced-motion` strips the journey and keeps the destination: bars
  reach their final width and counters land on their final number immediately.

---

## Sound

Synthesised in the browser, so there are no assets to ship and every cue is
short by construction. The palette is mechanical latches, low impacts and
filtered air — no melody, no chime, no fanfare.

| Cue | Where |
| --- | --- |
| `train` | A latch seating. Positive, mechanical, pitch rising slightly. |
| `fire` | A single low impact with a short tail. Not an explosion. |
| `reveal` | Sub-bass swell under an air lift. Felt more than heard. |
| `failure` | A machine spinning down. Fires when the chain reaches link 7. |
| `advance`, `tap`, `lock`, `settle`, `closing` | Structural, near-silent. |

Muted from the console (**Sound: on/off**), which silences every surface at
once. Nothing plays until the browser has had a real gesture.

To replace a cue with a recording, drop a file in `public/sounds/` and add its
path to `SOUND_SOURCES` in `lib/sound/cues.ts`. The manager prefers a file
whenever one exists and falls back to the synth otherwise.

---

## Quality gates

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run test:e2e    # 41 assertions — transport, votes, navigation, auth
npm run test:pg     # 17 assertions — the production store specifically
```

Both suites need a server running in another terminal, and both accept
`TRAIN_OR_FIRE_URL=https://…` to run against a deployment.

`test:pg` covers what the local driver cannot exercise: concurrent votes
serialising rather than overwriting, state surviving the process that wrote it,
the board still deriving correctly from a cold read, and a late joiner counting
once without backfilling the roles they missed. It refuses to run against a
server that is not on Postgres.

### What was verified in a browser

- **Every projector frame** — all 56 stage/beat combinations — measured for
  horizontal overflow, vertical overflow and elements crossing the viewport
  edge, at both **1366×768** and **1920×1080**. Zero problems at either. Minimum
  rendered font size 11.5px (the structural eyebrow labels) and 16px
  respectively.
- **Mobile** at 360×640, 390×844 and 430×740: every phone state — all four role
  decisions, both multiple-choice polls, locked, and waiting — with no scrolling
  and no horizontal overflow.
- **The QR rule**: swept all 56 frames and confirmed a code appears on the join
  stage only. Reopening a decision brings the corner code back; revealing it
  takes the code away. No code on any reveal, AAR, learning or closing screen.
- **The join overlay** raised from mid-AAR and lowered again returned the room
  to the identical stage, beat, phase and board.
- **Server restart** mid-session with the projector at stage 12 beat 4: stage,
  beat, phase, all 32 participants and all four board verdicts came back
  identical, and a participant's phone reconnected with its own vote still
  selected.
- **Scale**: 34 real HTTP participants in the test suite, plus 31 simulated,
  across a room/online mix.
- **Facilitator isolation**: a browser without the token gets the refusal
  screen, and participant credentials sent to `/control` are rejected 403.
