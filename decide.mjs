// When to post a checkpoint, and what to flag. Kept separate from the
// network code so it can be tested.
//
// Rule (Rob, 2026-11-18): once a day and after every round closes. The job
// runs hourly but must not post hourly: hourly line counts would show when
// people voted, which the vote log's voter codes are meant to hide.

/** @typedef {{ election_id: string, lines: number, fingerprint: string }} Head */
/** @typedef {{ election_id: string, round: string, lines: number, fingerprint: string, check: string }} Tally */
/** @typedef {{ at: string, reason: string, elections: Head[], tallies?: Tally[], warnings?: string[] }} Checkpoint */

/**
 * Returns why to post now, or null.
 * "close" is judged against the last posted checkpoint, not the last hour,
 * so a late or skipped run never loses a close.
 * @param {Checkpoint | null} previous the last posted checkpoint
 * @param {string} now the database's time for this run
 * @param {string | null} lastCloseAt the latest round close so far
 */
export function decide(previous, now, lastCloseAt) {
  if (!previous) return "first";
  const prevAt = Date.parse(previous.at);
  if (lastCloseAt && Date.parse(lastCloseAt) > prevAt) return "close";
  const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
  if (utcDay(Date.parse(now)) !== utcDay(prevAt)) return "daily";
  return null;
}

/**
 * A chain only grows. A fingerprint that changed without new lines, or a
 * line count that went down, means the log was altered or reset. It is
 * still posted (the public record shows it) and flagged.
 *
 * Final tallies (T54) never change once frozen: one that changed or went
 * missing is flagged, and so is a newly frozen tally whose check failed
 * (it disagreed with the vote log or the credit records).
 * @param {Checkpoint | null} previous
 * @param {Head[]} heads
 * @param {Tally[]} [tallies]
 */
export function warnings(previous, heads, tallies = []) {
  const out = [];
  const before = new Map((previous?.tallies ?? []).map((t) => [`${t.election_id} ${t.round}`, t]));
  const nowTallies = new Map(tallies.map((t) => [`${t.election_id} ${t.round}`, t]));
  for (const [k, old] of before) {
    const cur = nowTallies.get(k);
    if (!cur) out.push(`${k}: final tally missing`);
    else if (cur.fingerprint !== old.fingerprint) out.push(`${k}: final tally changed`);
  }
  for (const [k, cur] of nowTallies) {
    if (!before.has(k) && cur.check === "failed") out.push(`${k}: final tally check failed`);
  }
  if (!previous) return out;
  const now = new Map(heads.map((h) => [h.election_id, h]));
  for (const old of previous.elections) {
    const cur = now.get(old.election_id);
    if (!cur) out.push(`${old.election_id}: missing (had ${old.lines} lines)`);
    else if (cur.lines < old.lines) out.push(`${old.election_id}: lines went down from ${old.lines} to ${cur.lines}`);
    else if (cur.lines === old.lines && cur.fingerprint !== old.fingerprint)
      out.push(`${old.election_id}: fingerprint changed with no new lines`);
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;

/** Accept only the expected fields, so nothing else is ever published. */
export function cleanHeads(raw) {
  if (!Array.isArray(raw)) throw new Error("elections is not a list");
  return raw.map((h) => {
    if (!UUID.test(h?.election_id) || !Number.isInteger(h?.lines) || h.lines < 1 || !HASH.test(h?.fingerprint))
      throw new Error(`unexpected election entry: ${JSON.stringify(h)}`);
    return { election_id: h.election_id, lines: h.lines, fingerprint: h.fingerprint };
  });
}

const ROUNDS = new Set(["ideas", "votes", "production"]);
const CHECKS = new Set(["ok", "partial", "failed"]);

/** Final tallies (T54): the same rule, only the expected fields. */
export function cleanTallies(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("tallies is not a list");
  return raw.map((t) => {
    if (!UUID.test(t?.election_id) || !ROUNDS.has(t?.round) || !Number.isInteger(t?.lines) || t.lines < 0
        || !HASH.test(t?.fingerprint) || !CHECKS.has(t?.check))
      throw new Error(`unexpected tally entry: ${JSON.stringify(t)}`);
    return { election_id: t.election_id, round: t.round, lines: t.lines, fingerprint: t.fingerprint, check: t.check };
  });
}
