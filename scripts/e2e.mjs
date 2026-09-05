/**
 * End-to-end checks against a running Train or Fire server.
 *
 *   npm run dev          # in one terminal
 *   npm run test:e2e     # in another
 *
 * Covers the things that are expensive to get wrong in front of a room: the
 * live transport, vote integrity, the withholding of results before reveal,
 * and the promise that a facilitator's controls cannot be reached from a
 * participant's phone.
 */
const BASE = process.env.TRAIN_OR_FIRE_URL ?? "http://localhost:3000";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const post = async (path, body, headers = {}) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const get = async (path, headers = {}) => {
  const res = await fetch(BASE + path, { headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const waitFor = async (predicate, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
};

/* ---- create ------------------------------------------------------- */

const created = await post("/api/sessions", { title: "Train or Fire" });
check(
  "create session returns a 4-digit code",
  created.status === 201 && /^\d{4}$/.test(created.data.code ?? ""),
  created.data.code,
);
const code = created.data.code;
const token = created.data.facilitatorToken;
const hostHdr = { "x-facilitator-token": token };

/*
 * Casting a vote, with the one failure that is the harness's fault and not the
 * app's called out by name.
 *
 * This suite casts several hundred votes, and the server rate-limits voting to
 * 900 a minute per IP — correctly, because a room of phones behind one NAT is
 * the threat that limit exists for. Run the suite twice inside a minute and the
 * second run trips it, and every vote-dependent check then fails at once with
 * "0 votes recorded", which looks exactly like a serious regression and is not
 * one. Say what actually happened instead of printing twenty misleading reds.
 */
/*
 * Reading the public state, with transport failure told apart from a real one.
 *
 * Every check below indexes into the state it just read. When a read fails —
 * and against a remote database one will, eventually: a DNS blip, a cold pool,
 * a redeploy mid-run — the next line is a TypeError on `undefined`, tens of
 * frames deep, that looks nothing like what happened. Say it plainly instead.
 */
const readState = async () => {
  const r = await get(`/api/sessions/${code}`);
  if (r.status !== 200 || !Array.isArray(r.data?.board)) {
    console.log(`\nREAD FAILED — GET /api/sessions/${code} returned ${r.status}.\n`);
    console.log(String(JSON.stringify(r.data)).slice(0, 300));
    console.log("\nThis is the transport, not the activity. Re-run the suite; if it keeps");
    console.log("happening, check the server log for a database connection error.");
    process.exit(3);
  }
  return r.data;
};

const castVote = async (questionId, optionId, hdr) => {
  const r = await post(`/api/sessions/${code}/vote`, { questionId, optionId }, hdr);
  if (r.status === 429) {
    console.log("\nRATE LIMITED — the server refused a vote with 429.\n");
    console.log("This is the harness, not the app. The suite casts a few hundred votes and");
    console.log("voting is capped at 900/minute per IP. Wait a minute and run it again, or");
    console.log("restart the server to clear the window.");
    process.exit(2);
  }
  return r;
};


/* ---- SSE ---------------------------------------------------------- */

const frames = [];
const ac = new AbortController();
void (async () => {
  const res = await fetch(`${BASE}/api/sessions/${code}/stream`, { signal: ac.signal });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (line) frames.push(JSON.parse(line.slice(5)));
    }
  }
})().catch(() => {});

check("SSE delivers an initial frame", await waitFor(() => frames.length >= 1));
const first = frames[0] ?? {};
check("SSE state carries no facilitatorToken", !("facilitatorToken" in first));
check("SSE state carries no participants array", !("participants" in first));
check("SSE state carries no responses array", !("responses" in first));
check("SSE state carries no facilitator preview", !("preview" in first));

/* ---- join --------------------------------------------------------- */

const PARTICIPANTS = 34;
const people = [];
for (let i = 0; i < PARTICIPANTS; i += 1) {
  const mode = i % 3 === 0 ? "online" : "room";
  const r = await post(`/api/sessions/${code}/join`, { mode });
  if (r.status === 200) {
    people.push({
      id: r.data.participantId,
      secret: r.data.secret,
      mode,
      hdr: { "x-participant-id": r.data.participantId, "x-participant-secret": r.data.secret },
    });
  }
}
check(`${PARTICIPANTS} participants joined`, people.length === PARTICIPANTS, `${people.length}`);

const expectedOnline = people.filter((p) => p.mode === "online").length;
const expectedRoom = people.length - expectedOnline;

const afterJoin = await readState();
check(
  "room / online split is counted separately",
  afterJoin.counts.room === expectedRoom && afterJoin.counts.online === expectedOnline,
  `room ${afterJoin.counts.room}/${expectedRoom}, online ${afterJoin.counts.online}/${expectedOnline}`,
);

// Reconnect must not create a second participant.
const rejoin = await post(`/api/sessions/${code}/join`, {
  mode: people[0].mode,
  participantId: people[0].id,
  secret: people[0].secret,
});
const afterRejoin = await readState();
check(
  "reconnect reuses the same participant",
  rejoin.data.participantId === people[0].id &&
    afterRejoin.counts.total === people.length,
  `${afterRejoin.counts.total}`,
);

/* ---- authorisation ------------------------------------------------ */

const noToken = await post(`/api/sessions/${code}/control`, { command: { type: "next" } });
check("control without a token is refused", noToken.status === 403, `${noToken.status}`);

const badToken = await post(
  `/api/sessions/${code}/control`,
  { command: { type: "next" } },
  { "x-facilitator-token": "0".repeat(32) },
);
check("control with a wrong token is refused", badToken.status === 403, `${badToken.status}`);

const hostView = await get(`/api/sessions/${code}/control`, hostHdr);
check("facilitator view is reachable with the token", hostView.status === 200);
check("facilitator view includes per-stage progress", Array.isArray(hostView.data.progress));

/* ---- navigation --------------------------------------------------- */

await post(`/api/sessions/${code}/control`, { command: { type: "start" } }, hostHdr);

const stageIndexOf = async (id) => {
  const view = await get(`/api/sessions/${code}/control`, hostHdr);
  return view.data.progress.findIndex((p) => p.stageId === id);
};

const mdStage = await stageIndexOf("decide-md");
check("decide-md stage exists", mdStage >= 0, `${mdStage}`);

// Beats walk before stages do.
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: 0, beat: 0 } },
  hostHdr,
);
const beat0 = await readState();
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const beat1 = await readState();
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const stage1 = await readState();
check(
  "Next advances the beat before the stage",
  beat0.beat === 0 &&
    beat1.beat === 1 &&
    beat1.stageIndex === 0 &&
    stage1.stageIndex === 1,
  `beats ${beat0.beat}/${beat1.beat}, stage ${stage1.stageIndex}`,
);

await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
const backAgain = await readState();
check(
  "Back returns to the fully-built previous stage",
  backAgain.stageIndex === 0 && backAgain.beat === 1,
  `stage ${backAgain.stageIndex} beat ${backAgain.beat}`,
);

/* ---- voting ------------------------------------------------------- */

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: mdStage } },
  hostHdr,
);

const mdQ = "role-md";
const TRAIN = `${mdQ}:train`;
const FIRE = `${mdQ}:fire`;

// A deliberate, known split so the tally can be checked exactly.
const fireVoters = 11;
for (let i = 0; i < people.length; i += 1) {
  const optionId = i < fireVoters ? FIRE : TRAIN;
  await castVote(mdQ, optionId, people[i].hdr);
}

const voted = await readState();
check(
  "every vote was recorded once",
  voted.counts.responses === people.length,
  `${voted.counts.responses}/${people.length}`,
);
check("results stay hidden while voting is open", voted.results === null);
check("the board stays empty before reveal", (voted.board ?? []).length === 0);

// Changing your mind is allowed while voting is open.
await castVote(mdQ, TRAIN, people[0].hdr);
const changed = await readState();
check(
  "changing a vote does not add a second one",
  changed.counts.responses === people.length,
  `${changed.counts.responses}`,
);

const anonVote = await post(`/api/sessions/${code}/vote`, {
  questionId: mdQ,
  optionId: TRAIN,
});
check("voting without credentials is refused", anonVote.status === 401, `${anonVote.status}`);

const badOption = await post(
  `/api/sessions/${code}/vote`,
  { questionId: mdQ, optionId: "role-md:maybe" },
  people[1].hdr,
);
check("an unknown option is refused", badOption.status === 422, `${badOption.status}`);

const wrongStage = await post(
  `/api/sessions/${code}/vote`,
  { questionId: "role-finance", optionId: "role-finance:train" },
  people[1].hdr,
);
check(
  "voting on a decision that is not on screen is refused",
  wrongStage.status === 409,
  `${wrongStage.status}`,
);

/* ---- lock and reveal ---------------------------------------------- */

await post(`/api/sessions/${code}/control`, { command: { type: "lock" } }, hostHdr);
const lockedVote = await post(
  `/api/sessions/${code}/vote`,
  { questionId: mdQ, optionId: FIRE },
  people[2].hdr,
);
check("voting is refused once locked", lockedVote.status === 409, `${lockedVote.status}`);

const lockedState = await readState();
check("locking alone does not reveal the split", lockedState.results === null);

await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const revealed = await readState();

const trainTally = revealed.results.options.find((o) => o.optionId === TRAIN);
const fireTally = revealed.results.options.find((o) => o.optionId === FIRE);
const expectedFire = fireVoters - 1; // participant 0 changed their mind
const expectedTrain = people.length - expectedFire;

check(
  "the revealed tally is exactly the votes cast",
  trainTally.count === expectedTrain && fireTally.count === expectedFire,
  `train ${trainTally.count}/${expectedTrain}, fire ${fireTally.count}/${expectedFire}`,
);
check(
  "percentages sum to 100",
  Math.round(trainTally.pct + fireTally.pct) === 100,
  `${trainTally.pct.toFixed(1)} + ${fireTally.pct.toFixed(1)}`,
);

const board = revealed.board;
check("the role takes its place on the board", board.length === 1, `${board.length}`);
check(
  "the board records the majority side and the minority count",
  board[0].roleId === "md" &&
    board[0].verdict === "train" &&
    board[0].minorityCount === expectedFire,
  `${board[0]?.verdict} · minority ${board[0]?.minorityCount}`,
);

/* ---- the board survives navigation -------------------------------- */

const financeStage = await stageIndexOf("decide-finance");
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: financeStage } },
  hostHdr,
);
for (let i = 0; i < people.length; i += 1) {
  const optionId = i < 20 ? "role-finance:fire" : "role-finance:train";
  await castVote("role-finance", optionId, people[i].hdr);
}
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);

const twoPlaced = await readState();
check("the board builds up rather than resetting", twoPlaced.board.length === 2);

// Walk backwards over the revealed stages and forwards again.
for (let i = 0; i < 4; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
}
const afterBack = await readState();
check(
  "navigating backwards keeps both verdicts on the board",
  afterBack.board.length === 2,
  `${afterBack.board.length}`,
);

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: mdStage } },
  hostHdr,
);
const returned = await readState();
check(
  "returning to a revealed stage still shows its result",
  returned.phase === "revealed" &&
    returned.results?.options.find((o) => o.optionId === TRAIN)?.count === expectedTrain,
  `${returned.phase}`,
);

/* ---- Next cannot skip an unrevealed result ------------------------ */

/*
 * The facilitator is meant to be able to run the whole session on one key. That
 * only holds if the one key cannot walk past a vote the room just cast, so on
 * an unrevealed question Next reveals and stays put; the press after that moves
 * on. This is the single most load-bearing behaviour of the simplified console.
 */
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: mdStage } },
  hostHdr,
);
await post(`/api/sessions/${code}/control`, { command: { type: "unlock" } }, hostHdr);

const beforeSmartNext = (await readState());
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const afterFirstNext = (await readState());
check(
  "Next on an open decision reveals instead of advancing",
  beforeSmartNext.phase === "voting" &&
    afterFirstNext.phase === "revealed" &&
    afterFirstNext.stageIndex === mdStage,
  `phase ${beforeSmartNext.phase} -> ${afterFirstNext.phase}, stage ${afterFirstNext.stageIndex}`,
);

await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const afterSecondNext = (await readState());
check(
  "the next press then moves on, with the result kept",
  afterSecondNext.stageIndex === mdStage + 1 &&
    (await readState()).board.some((b) => b.roleId === "md"),
  `stage ${afterSecondNext.stageIndex}`,
);

await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
const afterBackToRevealed = (await readState());
check(
  "Back does not reopen voting on a revealed decision",
  afterBackToRevealed.stageIndex === mdStage && afterBackToRevealed.phase === "revealed",
  `stage ${afterBackToRevealed.stageIndex} phase ${afterBackToRevealed.phase}`,
);

/* ---- results never fall back to 0% ------------------------------- */

/*
 * The behaviour this whole release is about.
 *
 * A result that has been on the wall must survive everything the facilitator
 * can do to the session short of explicitly reopening it. It is not enough
 * that the tally is recomputable — the recomputation has to be impossible to
 * make wrong, which is why reveal writes a snapshot and every reader uses it.
 *
 * Each of the four roles is voted with a DIFFERENT, known split, so a result
 * that leaks from one role into another shows up as a wrong number rather than
 * as a passing test.
 */

const ROLE_QUESTIONS = ["role-md", "role-finance", "role-operations", "role-maintenance"];
const ROLE_STAGES = ["decide-md", "decide-finance", "decide-operations", "decide-maintenance"];
// Deliberately distinct, and deliberately not 50/50 — a tie is checked on its own below.
const FIRE_SPLIT = [9, 21, 25, 30];

await post(`/api/sessions/${code}/control`, { command: { type: "restart" } }, hostHdr);

const stageIndexes = [];
for (const id of ROLE_STAGES) stageIndexes.push(await stageIndexOf(id));

const expected = [];
for (let q = 0; q < ROLE_QUESTIONS.length; q += 1) {
  const questionId = ROLE_QUESTIONS[q];
  await post(
    `/api/sessions/${code}/control`,
    { command: { type: "goto", stageIndex: stageIndexes[q] } },
    hostHdr,
  );
  const fire = FIRE_SPLIT[q];
  for (let i = 0; i < people.length; i += 1) {
    await castVote(questionId, `${questionId}:${i < fire ? "fire" : "train"}`, people[i].hdr);
  }
  await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);

  const st = (await readState());
  const entry = st.board.find((b) => b.questionId === questionId || b.roleId === questionId.slice(5));
  expected.push({
    questionId,
    stageIndex: stageIndexes[q],
    fire,
    train: people.length - fire,
    trainPct: entry?.trainPct,
    firePct: entry?.firePct,
    placement: entry?.placement,
  });
}

check(
  "each role records its own distinct split",
  expected.every((e) => e.trainPct !== undefined) &&
    new Set(expected.map((e) => Math.round(e.trainPct))).size === expected.length,
  expected.map((e) => `${Math.round(e.trainPct)}%`).join(" · "),
);

const boardMatches = (board, label) => {
  for (const e of expected) {
    const entry = board.find((b) => b.roleId === e.questionId.slice(5));
    if (!entry) return `${label}: ${e.questionId} missing from the board`;
    if (entry.trainCount !== e.train || entry.fireCount !== e.fire) {
      return `${label}: ${e.questionId} is ${entry.trainCount}/${entry.fireCount}, expected ${e.train}/${e.fire}`;
    }
    if (Math.round(entry.trainPct) !== Math.round(e.trainPct)) {
      return `${label}: ${e.questionId} is ${Math.round(entry.trainPct)}%, expected ${Math.round(e.trainPct)}%`;
    }
    if (entry.placement !== e.placement) {
      return `${label}: ${e.questionId} placed ${entry.placement}, expected ${e.placement}`;
    }
  }
  return null;
};

// A. vote  B. reveal  C. next  D. back  E. identical — for every role.
let backForwardProblem = null;
for (const e of expected) {
  await post(
    `/api/sessions/${code}/control`,
    { command: { type: "goto", stageIndex: e.stageIndex } },
    hostHdr,
  );
  await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
  const forward = (await readState());
  backForwardProblem ??= boardMatches(forward.board, `after Next off ${e.questionId}`);

  await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
  const backAt = (await readState());

  if (backAt.stageIndex !== e.stageIndex) {
    backForwardProblem ??= `Back from ${e.questionId} landed on stage ${backAt.stageIndex}`;
  }
  if (backAt.phase !== "revealed") {
    backForwardProblem ??= `Back to ${e.questionId} left phase ${backAt.phase}`;
  }
  const train = backAt.results?.options.find((o) => o.optionId === `${e.questionId}:train`);
  const fire = backAt.results?.options.find((o) => o.optionId === `${e.questionId}:fire`);
  if (train?.count !== e.train || fire?.count !== e.fire) {
    backForwardProblem ??= `Back to ${e.questionId} shows ${train?.count}/${fire?.count}, expected ${e.train}/${e.fire}`;
  }
  backForwardProblem ??= boardMatches(backAt.board, `after Back to ${e.questionId}`);
}

check(
  "Back and Next preserve every role's exact percentages",
  backForwardProblem === null,
  backForwardProblem ?? `${expected.length} roles checked`,
);

// The verdict screen, then away from it and back again.
const verdictStage = await stageIndexOf("verdict");
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: verdictStage } },
  hostHdr,
);
const onVerdict = (await readState());
check(
  "the verdict board carries all four stored results",
  onVerdict.board.length === 4 && boardMatches(onVerdict.board, "verdict") === null,
  boardMatches(onVerdict.board, "verdict") ?? `${onVerdict.board.length} on the board`,
);
check(
  "no role on the verdict board is a 0% placeholder",
  onVerdict.board.every((b) => b.hasVotes && b.total > 0 && b.trainPct + b.firePct > 99),
  onVerdict.board.map((b) => `${b.roleId} ${Math.round(b.trainPct)}/${Math.round(b.firePct)}`).join(" · "),
);

await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const backToVerdict = (await readState());
check(
  "leaving the verdict board and returning changes nothing on it",
  JSON.stringify(backToVerdict.board) === JSON.stringify(onVerdict.board),
);

// A fresh read, the way a reloaded projector gets its state.
const reloaded = await readState();
check(
  "a fresh load returns identical stored results",
  JSON.stringify(reloaded.board) === JSON.stringify(onVerdict.board),
);

/*
 * The result must not track the responses that produced it.
 *
 * Clearing the rehearsal crowd removes their votes. Before reveal wrote a
 * snapshot, that silently rewrote every revealed percentage on the board —
 * which is one of the real routes by which a facilitator's board fell to 0%
 * mid-session, with no way to get it back.
 */
await post(`/api/sessions/${code}/control`, { command: { type: "simulate", count: 12 } }, hostHdr);
await post(`/api/sessions/${code}/control`, { command: { type: "clearSimulated" } }, hostHdr);
const afterCrowdChange = (await readState());
check(
  "a revealed result survives the rehearsal crowd being cleared",
  boardMatches(afterCrowdChange.board, "after clearSimulated") === null,
  boardMatches(afterCrowdChange.board, "after clearSimulated") ?? "unchanged",
);

/* ---- no votes is said in words, not as 0% ------------------------- */

const opsStage = await stageIndexOf("decide-operations");
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: opsStage } },
  hostHdr,
);
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "resetStage", questionId: "role-operations" } },
  hostHdr,
);
const clearedOps = (await readState());
check(
  "clearing a stage takes it back off the board rather than zeroing it",
  clearedOps.phase === "voting" &&
    clearedOps.results === null &&
    !clearedOps.board.some((b) => b.roleId === "operations"),
  `${clearedOps.board.length} on the board`,
);

// Reveal it with nobody having voted: the state must say "no votes", never 0/0.
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const emptyReveal = (await readState());
const emptyEntry = emptyReveal.board.find((b) => b.roleId === "operations");
check(
  "a decision revealed with no votes is marked pending, not a verdict",
  emptyReveal.results?.hasVotes === false &&
    emptyEntry?.placement === "pending" &&
    emptyEntry?.hasVotes === false &&
    emptyEntry?.verdict === null,
  `hasVotes ${emptyReveal.results?.hasVotes}, placement ${emptyEntry?.placement}, verdict ${emptyEntry?.verdict}`,
);
check(
  "a pending role never lands in the TRAIN or FIRE column",
  !emptyReveal.board.some((b) => b.roleId === "operations" && (b.placement === "train" || b.placement === "fire")),
);
check(
  "the other three roles are untouched by an empty reveal beside them",
  ["md", "finance", "maintenance"].every((id) => {
    const e = expected.find((x) => x.questionId === `role-${id}`);
    const b = emptyReveal.board.find((x) => x.roleId === id);
    return b && b.trainCount === e.train && b.fireCount === e.fire;
  }),
);

/* ---- an exact tie resolves to a split, not to a side -------------- */

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "resetStage", questionId: "role-operations" } },
  hostHdr,
);
const half = Math.floor(people.length / 2);
for (let i = 0; i < half * 2; i += 1) {
  await castVote(
    "role-operations",
    `role-operations:${i < half ? "train" : "fire"}`,
    people[i].hdr,
  );
}
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const tied = (await readState());
const tieEntry = tied.board.find((b) => b.roleId === "operations");
check(
  "an exact tie is a split decision, not a tiebreak onto TRAIN",
  tieEntry?.tie === true &&
    tieEntry?.placement === "split" &&
    tieEntry?.verdict === null &&
    tieEntry.trainCount === tieEntry.fireCount,
  `${tieEntry?.placement} · ${tieEntry?.trainCount}/${tieEntry?.fireCount}`,
);

/* ---- reopening voting is the ONE thing that clears a result ------- */

await post(`/api/sessions/${code}/control`, { command: { type: "unlock" } }, hostHdr);
const reopened = (await readState());
check(
  "unlocking reopens voting and withdraws the result from every screen",
  reopened.phase === "voting" &&
    reopened.results === null &&
    !reopened.board.some((b) => b.roleId === "operations"),
);

await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const rerevealed = (await readState());
check(
  "revealing again re-counts the votes that are actually there",
  rerevealed.board.find((b) => b.roleId === "operations")?.total === half * 2,
  `${rerevealed.board.find((b) => b.roleId === "operations")?.total}`,
);

/* ---- the Managing Director replaced the Maintenance Engineer ------ */

const allStages = (await get(`/api/sessions/${code}/control`, hostHdr)).data.progress;
check(
  "no stage, question or board entry mentions the old engineer role",
  !allStages.some((row) => row.stageId.includes("engineer") || (row.questionId ?? "").includes("engineer")) &&
    !JSON.stringify(rerevealed.board).includes("engineer"),
);
check(
  "the Managing Director is role 01 and votes independently",
  allStages.some((row) => row.stageId === "decide-md" && row.questionId === "role-md") &&
    rerevealed.board.find((b) => b.roleId === "md")?.total === people.length,
  `${rerevealed.board.find((b) => b.roleId === "md")?.total} decided`,
);

/* ---- a revisited decision comes back whole -------------------------- */

/*
 * The regression this exists for: a returning decision that had its result and
 * its evidence but no ROLE. A percentage without a name above it is not
 * something a room can argue with, and on a projector it is indistinguishable
 * from a bug.
 *
 * The screen renders identity from the activity script via the stage's own
 * roleId, and the result from the frozen snapshot — two independent sources,
 * where identity is never conditional on the result. These checks hold that
 * contract at the state level: whatever a client renders, everything it needs
 * for the complete frame must be present and unchanged on every revisit.
 */

const ROLE_TITLES = {
  md: "Managing Director",
  finance: "Finance Manager",
  operations: "Operations Manager",
  maintenance: "Maintenance Manager",
};

await post(`/api/sessions/${code}/control`, { command: { type: "restart" } }, hostHdr);

const decided = [];
for (let q = 0; q < ROLE_QUESTIONS.length; q += 1) {
  const questionId = ROLE_QUESTIONS[q];
  const roleId = questionId.slice(5);
  await post(
    `/api/sessions/${code}/control`,
    { command: { type: "goto", stageIndex: stageIndexes[q] } },
    hostHdr,
  );
  const fire = FIRE_SPLIT[q];
  for (let i = 0; i < people.length; i += 1) {
    await castVote(questionId, `${questionId}:${i < fire ? "fire" : "train"}`, people[i].hdr);
  }
  await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
  decided.push({ questionId, roleId, stageIndex: stageIndexes[q] });
}

/**
 * Everything the projector needs to draw one complete decision. Identity comes
 * from the stage; the result comes from the board entry. Both, or the frame is
 * incomplete.
 */
const frameOf = (state, roleId) => {
  const entry = state.board.find((b) => b.roleId === roleId) ?? null;
  return {
    stageRoleId: state.stage?.roleId ?? null,
    questionId: state.stage?.questionId ?? null,
    phase: state.phase,
    title: entry?.title ?? null,
    quote: entry?.quote ?? null,
    facts: entry?.facts ?? null,
    trainPct: entry ? Math.round(entry.trainPct) : null,
    firePct: entry ? Math.round(entry.firePct) : null,
    trainCount: entry?.trainCount ?? null,
    fireCount: entry?.fireCount ?? null,
    placement: entry?.placement ?? null,
    revealedAt: entry?.revealedAt ?? null,
    results: state.results
      ? state.results.options.map((o) => `${o.optionId}=${o.count}`).join(",")
      : null,
  };
};

const goTo = async (stageIndex) => {
  await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex } }, hostHdr);
  return (await readState());
};

let wholeProblem = null;
const captured = new Map();

for (const role of decided) {
  const state = await goTo(role.stageIndex);
  const frame = frameOf(state, role.roleId);
  captured.set(role.roleId, frame);

  if (frame.stageRoleId !== role.roleId) {
    wholeProblem ??= `${role.roleId}: stage reports roleId ${frame.stageRoleId}`;
  }
  if (frame.title !== ROLE_TITLES[role.roleId]) {
    wholeProblem ??= `${role.roleId}: title is ${JSON.stringify(frame.title)}`;
  }
  if (!frame.quote || !Array.isArray(frame.facts) || frame.facts.length === 0) {
    wholeProblem ??= `${role.roleId}: evidence or quote missing`;
  }
  if (frame.trainPct === null || frame.firePct === null) {
    wholeProblem ??= `${role.roleId}: result missing on a revealed decision`;
  }
}

check(
  "a revealed decision carries role, evidence, quote and result together",
  wholeProblem === null,
  wholeProblem ?? `${captured.size} roles`,
);

// The matrix the brief asks for: next, back, next, back, reload — per role.
let matrixProblem = null;
for (const role of decided) {
  const before = captured.get(role.roleId);

  for (const walk of [
    ["next", "back"],
    ["next", "back"],
  ]) {
    await goTo(role.stageIndex);
    for (const step of walk) {
      await post(`/api/sessions/${code}/control`, { command: { type: step } }, hostHdr);
    }
    const after = frameOf((await readState()), role.roleId);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      matrixProblem ??= `${role.roleId} after ${walk.join("/")}: ${JSON.stringify(after)} vs ${JSON.stringify(before)}`;
    }
  }

  // A reload is a fresh read with no client state at all.
  await goTo(role.stageIndex);
  const reloaded = frameOf((await readState()), role.roleId);
  if (JSON.stringify(reloaded) !== JSON.stringify(before)) {
    matrixProblem ??= `${role.roleId} after reload: ${JSON.stringify(reloaded)}`;
  }
}

check(
  "Back, Next and a reload return every role's frame byte for byte",
  matrixProblem === null,
  matrixProblem ?? `${decided.length} roles × next/back ×2 + reload`,
);

/* ---- no role's content bleeds into another ------------------------- */

/*
 * Reveal one role, walk to the next, reveal that, walk back, walk forward.
 * Each screen must carry its OWN name, evidence and quote — the failure this
 * guards is a stage that reconstructs its role from the previous frame rather
 * than from its own definition.
 */
let bleedProblem = null;
for (let i = 0; i < decided.length; i += 1) {
  const here = decided[i];
  const state = await goTo(here.stageIndex);

  if (state.stage?.roleId !== here.roleId) {
    bleedProblem ??= `stage ${here.stageIndex} reports ${state.stage?.roleId}`;
  }
  // The result on screen belongs to this stage's question and no other.
  if (state.results && state.results.questionId !== here.questionId) {
    bleedProblem ??= `stage ${here.stageIndex} shows results for ${state.results.questionId}`;
  }
  // Every other role's entry is still its own, unchanged.
  for (const other of decided) {
    if (other.roleId === here.roleId) continue;
    const entry = state.board.find((b) => b.roleId === other.roleId);
    if (!entry) {
      bleedProblem ??= `${other.roleId} vanished from the board while on ${here.roleId}`;
      continue;
    }
    if (entry.title !== ROLE_TITLES[other.roleId]) {
      bleedProblem ??= `${other.roleId} is titled ${entry.title} while on ${here.roleId}`;
    }
    const was = captured.get(other.roleId);
    if (Math.round(entry.trainPct) !== was.trainPct || entry.placement !== was.placement) {
      bleedProblem ??= `${other.roleId} changed while on ${here.roleId}`;
    }
  }
}

check(
  "no role's identity or result bleeds into another when navigating between them",
  bleedProblem === null,
  bleedProblem ?? `${decided.length} roles cross-checked`,
);

/* ---- a revisit is distinguishable from a reveal -------------------- */

/*
 * The projector animates the token and counts the percentages up on the
 * SHOWING of a reveal, and never again — a replay on every Back means the wall
 * spends most of a second holding a role that is not yet anywhere and a number
 * that is not the result. The client decides that from the reveal's identity:
 * the role plus the instant it was frozen. So that instant has to be stable
 * across navigation, or the client cannot tell the two apart.
 */
const freshFirst = captured.get("md").revealedAt;
await goTo(decided[0].stageIndex);
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
const revisitState = (await readState());
const revisitAt = revisitState.board.find((b) => b.roleId === "md")?.revealedAt;
check(
  "a revisited reveal keeps the identity that tells the projector not to replay it",
  typeof freshFirst === "number" && revisitAt === freshFirst,
  `${freshFirst} -> ${revisitAt}`,
);

// Reopening and revealing again IS a new event, and must say so.
await post(`/api/sessions/${code}/control`, { command: { type: "unlock" } }, hostHdr);
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const rerevealAt = (await readState()).board.find(
  (b) => b.roleId === "md",
)?.revealedAt;
check(
  "reopening and revealing again is a new reveal, not the old one",
  typeof rerevealAt === "number" && rerevealAt > freshFirst,
  `${freshFirst} -> ${rerevealAt}`,
);

/* ---- the verdict board is the same four snapshots ------------------ */

const verdictIndex = await stageIndexOf("verdict");
const onWall = (await goTo(verdictIndex)).board;
await goTo(decided[1].stageIndex);
const backOnWall = (await goTo(verdictIndex)).board;
check(
  "leaving the verdict board for a role and returning changes nothing on it",
  JSON.stringify(backOnWall) === JSON.stringify(onWall),
  `${onWall.length} roles`,
);
check(
  "every role on the verdict board still has a side, a name and a real result",
  onWall.length === 4 &&
    onWall.every(
      (b) =>
        b.title === ROLE_TITLES[b.roleId] &&
        b.hasVotes &&
        b.placement !== "pending" &&
        b.total > 0,
    ),
  onWall.map((b) => `${b.roleId}:${b.placement}`).join(" "),
);

/* ---- an unanswered decision still shows who it is about ------------ */

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "resetStage", questionId: "role-maintenance" } },
  hostHdr,
);
const emptyStage = await goTo(decided[3].stageIndex);
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const emptyRevealed = (await readState());
const emptyEntry2 = emptyRevealed.board.find((b) => b.roleId === "maintenance");
check(
  "a decision revealed with no votes still carries its role, evidence and quote",
  emptyStage.stage?.roleId === "maintenance" &&
    emptyEntry2?.title === ROLE_TITLES.maintenance &&
    Array.isArray(emptyEntry2?.facts) &&
    emptyEntry2.facts.length > 0 &&
    Boolean(emptyEntry2?.quote) &&
    emptyEntry2.hasVotes === false &&
    emptyEntry2.placement === "pending",
  `${emptyEntry2?.title} · ${emptyEntry2?.placement}`,
);

// Put the room back where the checks below expect it.
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: mdStage } },
  hostHdr,
);

/* ---- the join-code rule is stated in state, not per screen -------- */

/*
 * The projector shows the QR from exactly one field. If this contract drifts, a
 * question goes up with no way for a latecomer to join it.
 */
const hostProgress = (await get(`/api/sessions/${code}/control`, hostHdr)).data.progress;
let qrRuleHolds = true;
const qrChecked = [];
for (const row of hostProgress) {
  await post(
    `/api/sessions/${code}/control`,
    { command: { type: "goto", stageIndex: row.stageIndex } },
    hostHdr,
  );
  const st = (await readState());
  const expected = Boolean(row.questionId);
  qrChecked.push(row.stageId);
  if (st.requiresParticipantResponse !== expected) {
    qrRuleHolds = false;
    console.log(`      ${row.stageId}: expected ${expected}, got ${st.requiresParticipantResponse}`);
  }
}
check(
  "requiresParticipantResponse is true on exactly the question stages",
  qrRuleHolds,
  `${qrChecked.length} stages checked`,
);

/* ---- every stage declares which briefing the shell should show ---- */

const panels = new Set();
for (const row of hostProgress) {
  await post(
    `/api/sessions/${code}/control`,
    { command: { type: "goto", stageIndex: row.stageIndex } },
    hostHdr,
  );
  panels.add((await readState()).stage?.panel);
}
check(
  "every stage carries a valid panel mode for the persistent shell",
  [...panels].every((p) => ["briefing", "known", "quiet"].includes(p)),
  [...panels].join(", "),
);

// Those two sweeps walked the whole activity; put the room back on the role the
// checks below are written against.
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: mdStage } },
  hostHdr,
);

/* ---- the join overlay leaves the session alone -------------------- */

const beforeOverlay = await readState();
await post(`/api/sessions/${code}/control`, { command: { type: "showJoin" } }, hostHdr);
const withOverlay = await readState();
await post(`/api/sessions/${code}/control`, { command: { type: "hideJoin" } }, hostHdr);
const afterOverlay = await readState();

check(
  "the join overlay changes nothing underneath it",
  withOverlay.overlay === "join" &&
    afterOverlay.overlay === null &&
    afterOverlay.stageIndex === beforeOverlay.stageIndex &&
    afterOverlay.beat === beforeOverlay.beat &&
    afterOverlay.phase === beforeOverlay.phase &&
    afterOverlay.board.length === beforeOverlay.board.length,
);

/* ---- late join ---------------------------------------------------- */

const late = await post(`/api/sessions/${code}/join`, { mode: "online" });
check("a late arrival can still join mid-session", late.status === 200);
const lateHdr = {
  "x-participant-id": late.data.participantId,
  "x-participant-secret": late.data.secret,
};
const lateView = await get(`/api/sessions/${code}?participantId=${late.data.participantId}`);
check(
  "a late arrival sees the current stage, not the start",
  lateView.data.stageIndex === mdStage,
  `${lateView.data.stageIndex}`,
);

/* ---- a participant cannot reach the controls ---------------------- */

const participantControl = await post(
  `/api/sessions/${code}/control`,
  { command: { type: "next" } },
  lateHdr,
);
check(
  "participant credentials cannot drive the session",
  participantControl.status === 403,
  `${participantControl.status}`,
);

/* ---- a stale stream frame never moves the room backwards ---------- */

check(
  "stream revisions only ever increase",
  frames.every((f, i) => i === 0 || f.revision >= frames[i - 1].revision),
);

/* ---- reset -------------------------------------------------------- */

const beforeReset = (await readState());
await post(`/api/sessions/${code}/control`, { command: { type: "resetStage" } }, hostHdr);
const reset = await readState();
check(
  "clearing a stage removes its votes and its board entry, and only its own",
  reset.counts.responses === 0 &&
    reset.phase === "voting" &&
    !reset.board.some((b) => b.roleId === "md") &&
    reset.board.length === beforeReset.board.length - 1,
  `${reset.counts.responses} votes, ${reset.board.length} on board (was ${beforeReset.board.length})`,
);

/* ---- full walkthrough, forwards and back ------------------------- */

/*
 * Drive the whole activity with nothing but Next, the way a facilitator with a
 * clicker actually runs it, then walk the entire thing backwards. The board and
 * every vote must be identical at the end — this is the single check that a
 * mis-timed Back in front of a room cannot destroy the session.
 */
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: 0, beat: 0 } }, hostHdr);

const totalStages = (await readState()).stageCount;

let presses = 0;
let last = { stageIndex: -1, beat: -1, phase: null };
for (let i = 0; i < 200; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
  const st = (await readState());
  const same =
    st.stageIndex === last.stageIndex && st.beat === last.beat && st.phase === last.phase;
  if (same) break;
  last = { stageIndex: st.stageIndex, beat: st.beat, phase: st.phase };
  presses += 1;
}

check(
  "Next walks every stage to the end and then stops",
  last.stageIndex === totalStages - 1 && presses > totalStages,
  `${presses} presses, ended at stage ${last.stageIndex + 1}/${totalStages}`,
);

// Captured after the forward walk: Next reveals what it passes, so this is the
// state Back has to preserve.
const boardAtEnd = (await readState()).board;

let backPresses = 0;
for (let i = 0; i < 200; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
  const st = (await readState());
  backPresses += 1;
  if (st.stageIndex === 0 && st.beat === 0) break;
}

const end = (await readState());
check(
  "Back walks all the way home",
  end.stageIndex === 0 && end.beat === 0,
  `${backPresses} presses back, ${presses} forward`,
);
check(
  "a forward walk reveals every decision it passes",
  boardAtEnd.length === 4,
  `${boardAtEnd.length} verdicts on the board at the end`,
);
check(
  "walking all the way back leaves every verdict untouched",
  JSON.stringify(end.board) === JSON.stringify(boardAtEnd),
  `${end.board.length} on board after, ${boardAtEnd.length} before`,
);

ac.abort();
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
