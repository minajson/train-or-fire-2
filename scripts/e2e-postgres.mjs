/**
 * Production-store regression checks.
 *
 * These are the things that are true of the Postgres driver and NOT true of the
 * local one, so `npm run test:e2e` cannot catch them:
 *
 *   - concurrent votes serialise instead of overwriting each other
 *   - state survives the process that wrote it
 *   - the board is still derived from persisted votes after a cold read
 *   - a second "instance" sees the first instance's writes
 *
 * Run against a server started with TRAIN_FIRE_DATABASE_URL set:
 *
 *   TRAIN_FIRE_DATABASE_URL=postgres://... npm run dev
 *   npm run test:pg
 *
 * Point it at production with TRAIN_OR_FIRE_URL=https://…
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

/* ---- the driver actually in use ----------------------------------- */

const health = await get("/api/health");
check(
  "health reports the postgres driver",
  health.status === 200 && health.data.driver === "postgres",
  `driver=${health.data.driver} notify=${health.data.notify} ${health.data.latencyMs}ms`,
);
if (health.data.driver !== "postgres") {
  console.log("\nRefusing to continue: this server is not on Postgres.");
  process.exit(1);
}

/* ---- setup --------------------------------------------------------- */

const created = await post("/api/sessions", { title: "Train or Fire" });
const code = created.data.code;
const token = created.data.facilitatorToken;
const hostHdr = { "x-facilitator-token": token };
check("session created in postgres", created.status === 201 && /^\d{4}$/.test(code ?? ""), code);

const PEOPLE = 24;
const people = [];
for (let i = 0; i < PEOPLE; i += 1) {
  const mode = i % 2 === 0 ? "room" : "online";
  const r = await post(`/api/sessions/${code}/join`, { mode });
  people.push({
    mode,
    hdr: { "x-participant-id": r.data.participantId, "x-participant-secret": r.data.secret },
  });
}
check(`${PEOPLE} participants persisted`, (await get(`/api/sessions/${code}`)).data.counts.total === PEOPLE);

await post(`/api/sessions/${code}/control`, { command: { type: "start" } }, hostHdr);

const stageOf = async (id) => {
  const v = await get(`/api/sessions/${code}/control`, hostHdr);
  return v.data.progress.findIndex((p) => p.stageId === id);
};

/* ---- concurrent votes --------------------------------------------- */

/*
 * The failure this catches: read-modify-write without a row lock. Twenty-four
 * people voting in the same instant each read the session, add themselves, and
 * write it back — and without SELECT … FOR UPDATE, most of those writes land on
 * a stale document and the room loses votes it can see people casting.
 */
const engineerStage = await stageOf("decide-engineer");
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: engineerStage } }, hostHdr);

const FIRE_VOTERS = 9;
const results = await Promise.all(
  people.map((p, i) =>
    post(
      `/api/sessions/${code}/vote`,
      {
        questionId: "role-engineer",
        optionId: i < FIRE_VOTERS ? "role-engineer:fire" : "role-engineer:train",
      },
      p.hdr,
    ),
  ),
);
const badFirst = results.filter((r) => r.status !== 200);
check(
  "every concurrent vote was accepted",
  badFirst.length === 0,
  badFirst.length
    ? `${PEOPLE - badFirst.length}/${PEOPLE} ok; rejected: ${badFirst
        .map((r) => `${r.status} ${JSON.stringify(r.data).slice(0, 80)}`)
        .join(" | ")}`
    : `${PEOPLE}/${PEOPLE} ok`,
);

const afterConcurrent = await get(`/api/sessions/${code}`);
check(
  "no concurrent vote was lost to a stale write",
  afterConcurrent.data.counts.responses === PEOPLE,
  `${afterConcurrent.data.counts.responses}/${PEOPLE} recorded`,
);

/* ---- reveal, and the board it derives ------------------------------ */

await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const revealed = await get(`/api/sessions/${code}`);
const train = revealed.data.results.options.find((o) => o.optionId === "role-engineer:train");
const fire = revealed.data.results.options.find((o) => o.optionId === "role-engineer:fire");
check(
  "the persisted tally is exactly the votes cast",
  train.count === PEOPLE - FIRE_VOTERS && fire.count === FIRE_VOTERS,
  `train ${train.count}/${PEOPLE - FIRE_VOTERS}, fire ${fire.count}/${FIRE_VOTERS}`,
);

/* ---- all four roles ------------------------------------------------ */

const ROLES = [
  { id: "decide-finance", q: "role-finance", fire: 5 },
  { id: "decide-operations", q: "role-operations", fire: 16 },
  { id: "decide-maintenance", q: "role-maintenance", fire: 15 },
];
const rejected = [];
for (const role of ROLES) {
  const idx = await stageOf(role.id);
  await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: idx } }, hostHdr);
  const outcomes = await Promise.all(
    people.map((p, i) =>
      post(
        `/api/sessions/${code}/vote`,
        { questionId: role.q, optionId: i < role.fire ? `${role.q}:fire` : `${role.q}:train` },
        p.hdr,
      ),
    ),
  );
  for (const o of outcomes) {
    if (o.status !== 200) rejected.push(`${role.q} -> ${o.status} ${JSON.stringify(o.data).slice(0, 90)}`);
  }
  const recorded = (await get(`/api/sessions/${code}`)).data.counts.responses;
  check(
    `every concurrent vote on ${role.q} was recorded`,
    recorded === PEOPLE,
    `${recorded}/${PEOPLE}`,
  );
  await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
}
if (rejected.length) console.log("  rejected votes:\n    " + rejected.join("\n    "));

const fullBoard = (await get(`/api/sessions/${code}`)).data.board;
const boardShape = fullBoard.map((b) => `${b.roleId}:${b.verdict}`).join(",");
check(
  "all four verdicts are on the board, each exactly once",
  fullBoard.length === 4 && new Set(fullBoard.map((b) => b.roleId)).size === 4,
  boardShape,
);
check(
  "the board reflects the majorities that were actually voted",
  boardShape === "engineer:train,finance:train,operations:fire,maintenance:fire",
  boardShape,
);

/* ---- progress into the AAR, then read it back cold ----------------- */

const aarStage = await stageOf("system");
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: aarStage, beat: 4 } }, hostHdr);

const snapshot = await get(`/api/sessions/${code}`);
const fingerprint = JSON.stringify({
  stageIndex: snapshot.data.stageIndex,
  beat: snapshot.data.beat,
  total: snapshot.data.counts.total,
  board: snapshot.data.board,
});

/*
 * A cold read: a brand-new HTTP connection, no shared JS state with anything
 * above. On the local driver this proves nothing, because the answer comes out
 * of the same process's memory. Against Postgres — and especially against a
 * fresh Vercel instance — it is the whole point.
 */
await new Promise((r) => setTimeout(r, 300));
const cold = await fetch(`${BASE}/api/sessions/${code}`, {
  headers: { "cache-control": "no-cache" },
}).then((r) => r.json());
const coldFingerprint = JSON.stringify({
  stageIndex: cold.stageIndex,
  beat: cold.beat,
  total: cold.counts.total,
  board: cold.board,
});
check(
  "a cold read returns identical stage, beat, participants and board",
  coldFingerprint === fingerprint,
  `stage ${cold.stageIndex} beat ${cold.beat}, ${cold.board.length} on board`,
);

/* ---- late join, mid-session ---------------------------------------- */

const roleStage = await stageOf("decide-operations");
await post(`/api/sessions/${code}/control`, { command: { type: "goto", stageIndex: roleStage } }, hostHdr);
await post(`/api/sessions/${code}/control`, { command: { type: "unlock" } }, hostHdr);

const beforeLate = await get(`/api/sessions/${code}`);
const late = await post(`/api/sessions/${code}/join`, { mode: "online" });
const lateHdr = {
  "x-participant-id": late.data.participantId,
  "x-participant-secret": late.data.secret,
};
const lateView = await get(`/api/sessions/${code}?participantId=${late.data.participantId}`);
check(
  "a late arrival lands on the decision currently on screen",
  lateView.stageIndex === undefined ? lateView.data.stageIndex === roleStage : false,
  `stage ${lateView.data.stageIndex} vs ${roleStage}`,
);
check(
  "a late arrival has no vote on the current decision",
  lateView.data.you?.answered === false,
  `${JSON.stringify(lateView.data.you)}`,
);

const lateVote = await post(
  `/api/sessions/${code}/vote`,
  { questionId: "role-operations", optionId: "role-operations:train" },
  lateHdr,
);
const afterLate = await get(`/api/sessions/${code}`);
check(
  "the late vote counts and the participant total grew by exactly one",
  lateVote.status === 200 &&
    afterLate.data.counts.total === beforeLate.data.counts.total + 1,
  `${beforeLate.data.counts.total} → ${afterLate.data.counts.total}`,
);

await post(`/api/sessions/${code}/control`, { command: { type: "reveal" } }, hostHdr);
const withLate = await get(`/api/sessions/${code}`);
const opsEntry = withLate.data.board.find((b) => b.roleId === "operations");
check(
  "the late vote is included in the revealed total, and nothing was backfilled",
  opsEntry.total === PEOPLE + 1,
  `${opsEntry.total} votes on operations (${PEOPLE} + 1 late)`,
);
check(
  "no other role gained a vote from the late joiner",
  withLate.data.board.filter((b) => b.roleId !== "operations").every((b) => b.total === PEOPLE),
  withLate.data.board.map((b) => `${b.roleId}:${b.total}`).join(" "),
);

/* ---- security ------------------------------------------------------ */

const asParticipant = await post(
  `/api/sessions/${code}/control`,
  { command: { type: "next" } },
  lateHdr,
);
check("participant credentials cannot drive the session", asParticipant.status === 403, `${asParticipant.status}`);

const publicState = (await get(`/api/sessions/${code}`)).data;
const publicJson = JSON.stringify(publicState);
check("public state carries no facilitator token", !publicJson.includes(token));
check(
  "public state carries no participant secrets or identities",
  !("participants" in publicState) && !("responses" in publicState) && !("preview" in publicState),
);

/* ---- cleanup ------------------------------------------------------- */

console.log(`\nSession ${code} left in place for inspection.`);
console.log(`${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
