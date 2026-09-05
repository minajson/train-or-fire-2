# Train or Fire — The Warning Signs

A live decision experience for a hybrid HSE session. A critical machine has
failed. Four roles were involved — **Managing Director**, **Finance Manager**,
**Operations Manager**, **Maintenance Manager**. The room decides, one role at a
time, whether to **train** or **fire** each of them — and then discovers what
that decision actually fixed.

The Managing Director is the deliberately nuanced one. They maintained nothing
and rejected nothing; what they held was the only authority that could have
forced escalation, funding, shutdown or a signed risk acceptance, and they left
the matter with the functional teams. Delegation, or leadership failure — that
argument is the point of role 01.

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
| Projector | `/present/<code>` | The room. One persistent shell, never scrolls. |
| Participant | `/j/<code>` | Phones. One decision, two enormous controls. |
| Facilitator | `/host/<code>` | Back, Reveal, Next — and a live view of the projector. |

All three read the same live state over one SSE connection each, so they cannot
drift apart.

### The projector is one screen

```
┌───────────────────────────────────────────────────────────────┐
│ TRAIN OR FIRE                              ● LIVE · 34 JOINED │
├──────────────────┬────────────────────────────────────────────┤
│ THE INCIDENT     │  DECISION 03 / 04         ◉ 30 / 31 DECIDED│
│                  │                                            │
│ A critical …     │  Wouldn't stop production early.           │
│ …abnormal        │  “The readings weren't at trip level yet.” │
│  readings…       │                                            │
│                  │  ┌── ↑ TRAIN ──┐  ┌── ✕ FIRE ─────────┐    │
│ ────────────     │  │     58%     │  │      68%          │    │
│ [ QR ]  JOIN     │  │             │  │ ▌Operations Mgr │  │    │
│         6730     │  │ ▌MD    58%  │  │ Finance     61% │ ← →  │
└──────────────────┴────────────────────────────────────────────┘
```

The shell never changes. Only the right-hand stage does. There is no page
transition anywhere in the session, which is what lets the room feel it stayed
inside one experience from the first decision through the AAR.

The left column has three modes, declared per stage as `panel`:

| Mode | Shows | Used by |
| --- | --- | --- |
| `briefing` | The incident, with a few phrases in bold | The four decisions, the verdict |
| `known` | The compressed facts | The AAR |
| `quiet` | Nothing — the column collapses | The single-sentence screens and the close |

`quiet` is why "DID YOU FIX THE PROBLEM?" still gets the whole projector: the
architecture persists, the furniture gets out of the way.

Type on both panels is sized in **container units**, not viewport units, so a
headline sizes against the column it lives in rather than the window. One
warning from doing this: container-query units inside a container's *own*
padding resolve against the nearest **ancestor** container — the viewport, if
there is none. Putting `px-[7cqw]` on the briefing column itself gave it 95px of
side padding on a 410px column and squeezed its text to the 16px floor. The
padding belongs on an inner wrapper.

### When the join code is up

One rule, stated once in `PublicSessionState.requiresParticipantResponse` and
read by the shell:

> If the room can answer what is on screen, the code is up.

No per-screen exceptions, and it does not disappear on reveal — a latecomer
arriving mid-result still needs to be in before the next decision opens. It is
absent only on the screens nobody can answer: the verdict, the AAR narrative,
the learning reveals, the cost screens, the close.

### Facilitator keys

A presentation remote sends arrow keys, so the whole activity runs without
looking at the console. The same keys work on the projector window itself when
it is open on the facilitator's machine.

| Key | Action |
| --- | --- |
| `→` / `PageDown` | Next |
| `←` / `PageUp` | Back |
| `R` | Reveal |
| `Esc` | Lower the full-screen join code |

**Next is not a dumb advance.** On a question nobody has revealed, Next reveals
and stays put; the press after that moves on. A facilitator running the session
on one key cannot walk past a vote the room just cast — which would lose the
moment the whole activity is built around. Everything else a session might need
(reopen voting, jump to a section, full-screen QR, restart, end) lives behind
one `•••` menu, because a control that is only needed when something has gone
wrong should not compete with the three that are needed every ninety seconds.

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

Neither `back` nor `goto` touches votes or revealed phases, which is what makes
the facilitator's Back button safe mid-session: it can never erase a vote,
change a verdict, or reopen a closed question. Reopening is only ever explicit,
from the `•••` menu.

A facilitator never has to think in stages or beats — that vocabulary exists for
the code and for the emergency jump menu, not for the console.

Adding or reordering a stage means editing that one file. Nothing in the store,
transport, or control layers needs to change.

### The board, and why a revealed result is frozen

A role appears on the TRAIN/FIRE board only once its own question has been
revealed, which is what lets the board build up across the four decisions.

**Revealing a question writes down what it revealed.** `reveal` captures a
`ResultSnapshot` — raw per-option counts, plus the timestamp — into the session
record, and every screen reads the board from that snapshot rather than
recounting the response list (`src/lib/engine/board.ts`,
`src/lib/engine/tally.ts`).

The board used to be recomputed from `responses` on every read. That is correct
right up until something removes a response, and three things can: `restart`,
`resetStage`, and `clearSimulated`. Each of them silently rewrote percentages
that were already on the wall — a facilitator who cleared the rehearsal crowd
mid-session watched the room's real verdicts drop to 0% with no way to get them
back. A number an audience has seen has to be a fact, not a query.

So the only three commands that can take a result off the board are the three
that say so out loud: **unlock** (voting reopens), **resetStage** (the question
is cleared), **restart** (the session starts over). `next`, `back`, `goto`, a
reload, a redeploy and a change to the participant list cannot touch it.

Two board placements are deliberately not a side:

| `placement` | Means | Shown as |
| --- | --- | --- |
| `train` / `fire` | A real majority, from real votes | The percentage, in its zone |
| `split` | An exact tie | The token centred, "Split decision" |
| `pending` | Revealed with nobody having voted | "No votes yet" / "Pending" |

`pending` exists because "TRAIN 0% / FIRE 0%" reads as a decision when it is the
absence of one, and a facilitator pressing Next past an unanswered question is
the ordinary way to produce it. Nothing in the app renders 0% as a verdict.

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
| A whole room votes the instant a decision opens | Queries go through the **pooled** endpoint. Every warm instance holds its own pool, so a cold burst against a direct endpoint exhausts connections — measured as 13 of 24 votes returning 500. |
| The voter's instance is not the projector's instance | A revision poll scoped to the codes this instance has screens open for, with `LISTEN/NOTIFY` as an optional fast path. Correctness comes from the poll. |
| A connection blinks mid-vote | Transport and contention faults (`08xxx`, `53300`, `40001`, `40P01`, …) retry up to three times. Application rejections — a closed question, a bad option — never retry. |

Those middle two rows are where the care went.

A **transaction pooler is the right home for the queries**: a transaction is its
unit of work, so `BEGIN … SELECT … FOR UPDATE … COMMIT` stays pinned to one
server connection and the row lock is exactly as strong as it looks. What a
transaction pooler cannot carry is `LISTEN`, which it drops silently — no error,
just a projector that never updates. So `LISTEN` gets its own direct connection
via `TRAIN_FIRE_DATABASE_URL_DIRECT` when one is configured, and is skipped
entirely when it is not.

That is safe to skip because the hub tells the driver which codes it is serving
(`SessionStore.setActiveCodes`) and the driver polls exactly those, by primary
key, reading only the generated `revision` column. One index lookup per open
session per tick.

The schema is created only when `to_regclass` says the table is missing. Running
its `DROP TRIGGER` / `CREATE TRIGGER` on every cold start would take an ACCESS
EXCLUSIVE lock on the table precisely when a burst of new instances is trying to
read it.

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
| `TRAIN_FIRE_DATABASE_URL` | Production, **server only** | The source of truth. Use the **pooled** endpoint. Never prefix with `NEXT_PUBLIC_`. |
| `TRAIN_FIRE_DATABASE_URL_DIRECT` | Production, server only, optional | Session-mode URL, used only for `LISTEN`. Unset is supported — the poll covers it. |
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

## The 2D scene system

The projector is drawn, not decorated. Everything visual in the session is flat
vector — SVG paths, strokes, and a handful of transforms — and it lives in
[`src/components/present/scene/`](src/components/present/scene/) plus
[`src/lib/motion/primitives.tsx`](src/lib/motion/primitives.tsx). No WebGL, no
canvas, no particle system: this has to stay smooth on whatever laptop is
plugged into the projector.

| Piece | What it is |
| --- | --- |
| `MachineSchematic` | The pump package in elevation, walking a seven-step condition sequence |
| `MachinePanel` | A 16:9 frame holding the schematic, or footage if any exists |
| `WarningWave` | A live vibration trace — 1× running speed plus a second harmonic |
| `SignalPulse` | A status lamp: rings out of a solid centre |
| `RiskMarker` | "Opportunity to act", drawn as a cut across the causal path |
| `AmbientLinework` | The ghosted drawing sheet behind the title and join screens |
| `RoleToken` / `TokenSlot` / `TokenArena` | The role as a physical tag, and its journey |
| `ChainView` | The failure chain as connected nodes |

Four rules keep it reading as instrumentation rather than ornament:

1. **Line first.** Fills appear only where something is genuinely a solid object
   — a token, a status lamp — never as a gradient wash.
2. **Colour is state.** Red means the machine has tripped. Amber means a warning
   is live. Nothing is tinted for atmosphere.
3. **One waveform per screen.** A trace that is decoration stops meaning "this
   is the machine".
4. **Nothing physically impossible.** The audience is operations and maintenance
   people who will find the lie instantly, and the moment they do, the argument
   the session is making stops being credible. So the shaft *slows* as the
   bearing degrades rather than visibly wobbling; vibration shows up as trace
   amplitude and a millimetre-scale tremor; the temperature recovers across the
   temporary fix and then goes further; and the trip is a **stop**, not an
   explosion, because that is what a protection system doing its job looks like.

### A decision is one object, and identity is not conditional

The decision screen renders from a single pure function, `decisionView`, and two
independent sources feed it:

- **Identity** — role, marker, facts, quote — comes from the activity script via
  the stage's own `roleId`. It is a constant. It does not depend on the phase,
  the beat, the board, an animation, or anything the client is holding.
- **Result** — the split and the placement — comes from the frozen snapshot, and
  only once the question is revealed.

Identity is therefore never conditional on the result being present. That
asymmetry is the whole rule, and it exists because the alternative shipped: the
revealed view once dropped its title and let the token inside the winning zone
carry the name, so a returning decision could come back as evidence and
percentages under no heading at all. A percentage without a role is not a
result; it is a number the room cannot argue with.

The header — decision number, title, evidence, quote — is now **the same DOM in
both phases**. Revealing changes nothing in it, so returning cannot rebuild it
wrongly. The title is set at the same size as TRAIN and FIRE, because on a
screen the facilitator has just navigated back to, the audience's first question
is "who is this?" and it has to be answerable before "what did we decide?".

### The reveal animates once, and only once

The token travelling into its zone and the percentages counting up are how a
room is told *the answer is in*. Replaying them on every Back tells the room the
answer is coming in again — and for the length of the flight the wall holds a
role that is not yet anywhere and a number that is not the result. That is what
a facilitator sees as "the role vanished" or "the percentages fell back".

A clock cannot decide this alone: a facilitator can reveal, press Next and press
Back inside two seconds, and that is a revisit. So the authority is
`src/lib/client/reveal-seen.ts`, a module-scoped register of the reveals this
page has actually displayed, keyed by role plus the instant the result was
frozen. Module scope is the point — it outlives the stage component, which
unmounts on every Back and Next, and it dies with the page, because a fresh load
genuinely has not shown anything yet. A wall-clock window covers only that
reload case. Re-revealing after an unlock gets a new timestamp and is correctly
treated as a new event.

When the answer is "revisit", `TokenSlot` drops its `layoutId` entirely rather
than shortening the transition. A layout id is a standing claim that this is the
same object Framer last saw under that id; leaving it in place invites a flight
from wherever the token was on the previous screen. Without it the token is
simply drawn where it belongs, on the first frame.

The token also lives *inside* its zone rather than floating over the arena. As
an overlay it landed on top of the percentage on a 768px-tall projector — the
two things the audience most needs to read, in the same place.

### The machine failure video

The incident stage **opens on footage**: fifteen seconds of a real pump package
going from stable operation to a controlled emergency stop, at
`public/media/machine-failure.mp4`.

It has the first beat to itself, at the largest true 16:9 rectangle the
projector allows, with nothing else on screen. A room cannot watch a machine
fail and read a sentence at the same time; asked to do both, they do neither.
The narrative begins on the facilitator's next press, against the still frame
the clip ends on — machine stopped, warnings active, production interrupted —
which is the image the session then argues about for forty minutes.

The frame is sized from its **height**, not its width. Driving it from the width
lets `max-h-full` clamp the height, the aspect ratio loses, and the footage sits
pillarboxed in a 2.09:1 box on a 1366×768 projector — which is precisely the
"embedded video player" look this is not. `object-contain` guarantees a
replacement clip at another ratio letterboxes rather than stretching or
cropping; what `cover` would crop from a shot of a machine is the machine.

Playback is muted, autoplay, `playsInline`, **once**, no loop, no controls, and
no browser chrome around them. Going Back to that beat replays it.

**And none of it is load-bearing.** `MachineFootage` renders the schematic
first and swaps only once the browser reports `canplay`. With no file the
request 404s, `canplay` never fires, and the beat is the machine drawn instead
of filmed. There is no error state to recover from, and no external URL — a
conference network that cannot reach a CDN must not be able to break a session.

The schematic that accompanies the narrative beats follows the story rather than
marching monotonically: the incident opens in the present tense, rewinds several
weeks, and returns. `INCIDENT_MACHINE_STEP` maps each line to its condition, so
"a critical production machine has failed" is never captioned *Normal
operation*.

Encode replacements for delivery — the ffmpeg command, and why the audio track
and cover-art stream go, are in
[`docs/MACHINE_FAILURE_VIDEO_PROMPT.md`](docs/MACHINE_FAILURE_VIDEO_PROMPT.md)
along with the generation prompt. The committed file is 5.9 MB, down from a
15 MB raw export with no visible difference.

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
  reach their final width, counters land on their final number, the token
  arrives in its zone, and the machine reaches its failed state — all
  immediately. Nothing in the activity is comprehensible only if you watched it
  move. Every scene component reads the same `useMotionOff()` helper.

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
npm run test:e2e    # 47 assertions — transport, votes, navigation, auth, QR rule
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

- **Every projector frame** — all 23 stages, beat by beat — measured for
  horizontal overflow, vertical overflow and elements crossing the viewport
  edge, at both **1366×768** and **1920×1080**. Zero problems at either. (The
  sweep does flag the fired-role tags on the twist screen: they animate off the
  right edge deliberately, and were confirmed at effective opacity 0 inside an
  `overflow-hidden` frame with `scrollWidth === innerWidth`.)
- **The Back/Next matrix, in the DOM, for all four roles.** Title, title size,
  every evidence line, the quote, both percentages and the token's zone captured
  from the rendered page, then compared after next/back, again after
  next/back, and again after a full reload. Byte-identical in all sixteen
  comparisons — and the title is present in every sampled frame *during* a
  reveal flight, so identity never disappears mid-animation.
- **The join-code rule**, at thirteen checkpoints: up on all four decisions, the
  chain question and the final poll; absent on the verdict, the twist, the
  rewind, the system question, the learning reveals, the cost screens and the
  close.
- **Legibility of the briefing column**: 23px at 1366×768, 30px at 1920×1080,
  with the join QR at 174px and 244px respectively.
- **Mobile** at 360×640, 390×844 and 430×740: every phone state — the four role
  decisions, both polls, locked, and waiting — with no scrolling and no
  horizontal overflow.
- **Production**: QR decoded from rendered pixels to the public URL, a late
  joiner from a cleared browser landing on the current decision and voting,
  state surviving a redeploy onto fresh instances, and 45 concurrent voters
  across four bursts with 180/180 votes accepted.
