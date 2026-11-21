# Votes.Media vote log checkpoints

Every vote on Votes.Media is written to its election's vote log. Each line of the log carries a fingerprint (a SHA-256 hash) worked out from that line and the fingerprint of the line before it, so changing or removing any past line changes every fingerprint after it.

This repository publishes each election's latest fingerprint, so the log can't be quietly rewritten later: a rewritten log would no longer match a fingerprint posted here.

## What's here

- `checkpoints.jsonl`: every checkpoint ever posted, one per line, oldest first.
- `latest.json`: the most recent checkpoint.

Each checkpoint lists, for every election that has a vote log:

| Field | Meaning |
| --- | --- |
| `election_id` | The election's ID (no title or community name) |
| `lines` | How many lines its log had at that moment |
| `fingerprint` | The fingerprint of its last line |

plus the time (`at`, from the database clock) and why it was posted:

- `first`: the first checkpoint.
- `daily`: the first check after midnight UTC.
- `close`: an Ideas, Votes or Production round closed since the last checkpoint.

When a round closes, the result is frozen (see below), and each checkpoint also lists every frozen result under `tallies`:

| Field | Meaning |
| --- | --- |
| `election_id` | The election's ID |
| `round` | `ideas`, `votes` or `production` |
| `lines` | How many lines the election's log had when the result was frozen |
| `fingerprint` | The frozen result's own fingerprint |
| `check` | `ok`: the result matched the vote log (and, for Votes, the credit records). `partial`: the election was already running when the log started, so earlier votes couldn't be checked. `failed`: something disagreed. |

`warnings` appears only if something looks wrong since the last checkpoint:

- a log has fewer lines, or a new fingerprint with no new lines (a log only ever grows);
- a frozen result changed or disappeared (they never change);
- a newly frozen result's check failed.

Nothing here identifies a voter. Voter codes, names and log lines are not published in this repository.

## How it's posted

[`.github/workflows/checkpoint.yml`](.github/workflows/checkpoint.yml) runs every hour. It calls the public `vote_log_checkpoint` function of the Votes.Media database with the app's public key (the same key every visitor's browser uses) and commits a checkpoint when one is due. No secret is involved, and the history of this repository is the record: anyone can mirror it.

## Frozen results

When an Ideas or Votes round closes, and once Production has closed, Votes.Media freezes its result: the counts, the result, and the vote log's line count and fingerprint at that moment. Production is frozen once per election, for every winning topic: its questions or host's choices and its references, with the topic's backers' thumbs (only backers' thumbs decide). An election without a Production stage gets the same Production result when Votes settles, for its featured references. The database recounts the result by replaying the log and records whether the two agree. For Votes, it also checks the credits: every paid ballot was charged once, then kept (it backed a winner) or refunded. A ballot withdrawn before Votes closed doesn't count among the ballots: its credit was held and then given back, and the log shows the ballot removed. The frozen result's fingerprint is the SHA-256 of one line of text, its fields joined by `|` (format `t1`):

```
t1|election_id|round|closes_at|log_lines|log_fingerprint|counts|result|log_check|credit_check|credit_totals
```

- `closes_at`: UTC with milliseconds, e.g. `2026-11-18T12:00:00.000Z`
- `counts`: one entry per item, sorted by ID, joined by `,`. Ideas: `id:net:1` (net = thumbs up minus down; `1` if the idea had a matching reference, else `0`). Votes: `id:picks`. Production: `id:o:up:down` for a question or host's choice, `id:r:up:down` for a reference (the backers' thumbs up and down).
- `result`: the finalist or winner IDs in order, joined by `,`. Production: for each winning topic in the Votes order, its chosen questions or choices by rank, then its featured references by rank.
- `log_check`: `match`, `partial`, `mismatch` or `error`
- `credit_check` and `credit_totals`: empty for Ideas and Production. For Votes, `ok`, `partial`, `failed` or `error`, and `ballots:N,paid:N,kept:N,refunded:N`

## Checking an election

When an election's log and results can be downloaded (coming with the tally pages), recompute the log's fingerprints from the first line. If the fingerprint of line `lines` matches a checkpoint posted here, nothing up to that line has changed since that checkpoint was posted. Recount the result from those lines and recompute its fingerprint: if it matches a `tallies` entry here, the published result is the one frozen at close.
