// Posts a checkpoint of every election's vote log fingerprint, when due.
// Run by .github/workflows/checkpoint.yml in the public checkpoint repo:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node post-checkpoint.mjs <repo dir>
// The key is the app's public key (it ships in every page of the app); it
// can only call public functions.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanHeads, decide, warnings } from "./decide.mjs";

const dir = process.argv[2] ?? ".";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");

const res = await fetch(`${url}/rest/v1/rpc/vote_log_checkpoint`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
if (!res.ok) throw new Error(`vote_log_checkpoint failed: ${res.status} ${await res.text()}`);
const data = await res.json();

const latestPath = join(dir, "latest.json");
const previous = existsSync(latestPath) ? JSON.parse(readFileSync(latestPath, "utf8")) : null;
const reason = decide(previous, data.at, data.last_close_at ?? null);
if (!reason) {
  console.log(`Nothing to post (last checkpoint ${previous.at}).`);
  process.exit(0);
}

const elections = cleanHeads(data.elections);
const flagged = warnings(previous, elections);
const checkpoint = { at: data.at, reason, elections, ...(flagged.length ? { warnings: flagged } : {}) };

appendFileSync(join(dir, "checkpoints.jsonl"), JSON.stringify(checkpoint) + "\n");
writeFileSync(latestPath, JSON.stringify(checkpoint, null, 2) + "\n");
console.log(`Posted ${reason} checkpoint at ${data.at}: ${elections.length} elections.`);
for (const w of flagged) console.log(`WARNING ${w}`);
