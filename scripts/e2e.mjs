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

const afterJoin = await get(`/api/sessions/${code}`);
check(
  "room / online split is counted separately",
  afterJoin.data.counts.room === expectedRoom && afterJoin.data.counts.online === expectedOnline,
  `room ${afterJoin.data.counts.room}/${expectedRoom}, online ${afterJoin.data.counts.online}/${expectedOnline}`,
);

// Reconnect must not create a second participant.
const rejoin = await post(`/api/sessions/${code}/join`, {
  mode: people[0].mode,
  participantId: people[0].id,
  secret: people[0].secret,
});
const afterRejoin = await get(`/api/sessions/${code}`);
check(
  "reconnect reuses the same participant",
  rejoin.data.participantId === people[0].id &&
    afterRejoin.data.counts.total === people.length,
  `${afterRejoin.data.counts.total}`,
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

const engineerStage = await stageIndexOf("decide-engineer");
check("decide-engineer stage exists", engineerStage >= 0, `${engineerStage}`);

// Beats walk before stages do.
await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: 0, beat: 0 } },
  hostHdr,
);
const beat0 = await get(`/api/sessions/${code}`);
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const beat1 = await get(`/api/sessions/${code}`);
await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
const stage1 = await get(`/api/sessions/${code}`);
check(
  "Next advances the beat before the stage",
  beat0.data.beat === 0 &&
    beat1.data.beat === 1 &&
    beat1.data.stageIndex === 0 &&
    stage1.data.stageIndex === 1,
  `beats ${beat0.data.beat}/${beat1.data.beat}, stage ${stage1.data.stageIndex}`,
);

await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
const backAgain = await get(`/api/sessions/${code}`);
check(
  "Back returns to the fully-built previous stage",
  backAgain.data.stageIndex === 0 && backAgain.data.beat === 1,
  `stage ${backAgain.data.stageIndex} beat ${backAgain.data.beat}`,
);

/* ---- voting ------------------------------------------------------- */

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: engineerStage } },
  hostHdr,
);

const engineerQ = "role-engineer";
const TRAIN = `${engineerQ}:train`;
const FIRE = `${engineerQ}:fire`;

// A deliberate, known split so the tally can be checked exactly.
const fireVoters = 11;
for (let i = 0; i < people.length; i += 1) {
  const optionId = i < fireVoters ? FIRE : TRAIN;
  await post(`/api/sessions/${code}/vote`, { questionId: engineerQ, optionId }, people[i].hdr);
}

const voted = await get(`/api/sessions/${code}`);
check(
  "every vote was recorded once",
  voted.data.counts.responses === people.length,
  `${voted.data.counts.responses}/${people.length}`,
);
check("results stay hidden while voting is open", voted.data.results === null);
check("the board stays empty before reveal", (voted.data.board ?? []).length === 0);

// Changing your mind is allowed while voting is open.
await post(`/api/sessions/${code}/vote`, { questionId: engineerQ, optionId: TRAIN }, people[0].hdr);
const changed = await get(`/api/sessions/${code}`);
check(
  "changing a vote does not add a second one",
  changed.data.counts.responses === people.length,
  `${changed.data.counts.responses}`,
);

const anonVote = await post(`/api/sessions/${code}/vote`, {
  questionId: engineerQ,
  optionId: TRAIN,
});
check("voting without credentials is refused", anonVote.status === 401, `${anonVote.status}`);

const badOption = await post(
  `/api/sessions/${code}/vote`,
  { questionId: engineerQ, optionId: "role-engineer:maybe" },
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
  { questionId: engineerQ, optionId: FIRE },
  people[2].hdr,
);
check("voting is refused once locked", lockedVote.status === 409, `${lockedVote.status}`);

const lockedState = await get(`/api/sessions/${code}`);
check("locking alone does not reveal the split", lockedState.data.results === null);

await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const revealed = await get(`/api/sessions/${code}`);

const trainTally = revealed.data.results.options.find((o) => o.optionId === TRAIN);
const fireTally = revealed.data.results.options.find((o) => o.optionId === FIRE);
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

const board = revealed.data.board;
check("the role takes its place on the board", board.length === 1, `${board.length}`);
check(
  "the board records the majority side and the minority count",
  board[0].roleId === "engineer" &&
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
  await post(`/api/sessions/${code}/vote`, { questionId: "role-finance", optionId }, people[i].hdr);
}
await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);

const twoPlaced = await get(`/api/sessions/${code}`);
check("the board builds up rather than resetting", twoPlaced.data.board.length === 2);

// Walk backwards over the revealed stages and forwards again.
for (let i = 0; i < 4; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
}
const afterBack = await get(`/api/sessions/${code}`);
check(
  "navigating backwards keeps both verdicts on the board",
  afterBack.data.board.length === 2,
  `${afterBack.data.board.length}`,
);

await post(
  `/api/sessions/${code}/control`,
  { command: { type: "goto", stageIndex: engineerStage } },
  hostHdr,
);
const returned = await get(`/api/sessions/${code}`);
check(
  "returning to a revealed stage still shows its result",
  returned.data.phase === "revealed" &&
    returned.data.results?.options.find((o) => o.optionId === TRAIN)?.count === expectedTrain,
  `${returned.data.phase}`,
);

/* ---- the join overlay leaves the session alone -------------------- */

const beforeOverlay = await get(`/api/sessions/${code}`);
await post(`/api/sessions/${code}/control`, { command: { type: "showJoin" } }, hostHdr);
const withOverlay = await get(`/api/sessions/${code}`);
await post(`/api/sessions/${code}/control`, { command: { type: "hideJoin" } }, hostHdr);
const afterOverlay = await get(`/api/sessions/${code}`);

check(
  "the join overlay changes nothing underneath it",
  withOverlay.data.overlay === "join" &&
    afterOverlay.data.overlay === null &&
    afterOverlay.data.stageIndex === beforeOverlay.data.stageIndex &&
    afterOverlay.data.beat === beforeOverlay.data.beat &&
    afterOverlay.data.phase === beforeOverlay.data.phase &&
    afterOverlay.data.board.length === beforeOverlay.data.board.length,
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
  lateView.data.stageIndex === engineerStage,
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

await post(`/api/sessions/${code}/control`, { command: { type: "resetStage" } }, hostHdr);
const reset = await get(`/api/sessions/${code}`);
check(
  "clearing a stage removes its votes and its board entry",
  reset.data.counts.responses === 0 &&
    reset.data.phase === "voting" &&
    reset.data.board.length === 1,
  `${reset.data.counts.responses} votes, ${reset.data.board.length} on board`,
);

/* ---- full walkthrough, forwards and back ------------------------- */

/*
 * Drive the whole activity with nothing but Next, the way a facilitator with a
 * clicker actually runs it, then walk the entire thing backwards. The board and
 * every vote must be identical at the end — this is the single check that a
 * mis-timed Back in front of a room cannot destroy the session.
 */
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: 0, beat: 0 } }, hostHdr);

const boardBefore = JSON.stringify((await get(`/api/sessions/${code}`)).data.board);
const totalStages = (await get(`/api/sessions/${code}`)).data.stageCount;

let presses = 0;
let last = { stageIndex: -1, beat: -1 };
for (let i = 0; i < 200; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "next" } }, hostHdr);
  const st = (await get(`/api/sessions/${code}`)).data;
  if (st.stageIndex === last.stageIndex && st.beat === last.beat) break;
  last = { stageIndex: st.stageIndex, beat: st.beat };
  presses += 1;
}

check(
  "Next walks every stage to the end and then stops",
  last.stageIndex === totalStages - 1 && presses > totalStages,
  `${presses} presses, ended at stage ${last.stageIndex + 1}/${totalStages}`,
);

let backPresses = 0;
for (let i = 0; i < 200; i += 1) {
  await post(`/api/sessions/${code}/control`, { command: { type: "back" } }, hostHdr);
  const st = (await get(`/api/sessions/${code}`)).data;
  backPresses += 1;
  if (st.stageIndex === 0 && st.beat === 0) break;
}

const end = (await get(`/api/sessions/${code}`)).data;
check(
  "Back walks all the way home in the same number of presses",
  backPresses === presses && end.stageIndex === 0 && end.beat === 0,
  `${backPresses} back vs ${presses} forward`,
);
check(
  "a full round trip leaves every verdict untouched",
  JSON.stringify(end.board) === boardBefore,
  `${end.board.length} on board`,
);

ac.abort();
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
