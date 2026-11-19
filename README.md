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

`warnings` appears only if a log looks altered since the last checkpoint: fewer lines, or a new fingerprint with no new lines. A log only ever grows.

Nothing here identifies a voter. Voter codes, names and log lines are not published in this repository.

## How it's posted

[`.github/workflows/checkpoint.yml`](.github/workflows/checkpoint.yml) runs every hour. It calls the public `vote_log_checkpoint` function of the Votes.Media database with the app's public key (the same key every visitor's browser uses) and commits a checkpoint when one is due. No secret is involved, and the history of this repository is the record: anyone can mirror it.

## Checking an election

When an election's log can be downloaded (coming with the tally pages), recompute its fingerprints from the first line. If the fingerprint of line `lines` matches a checkpoint posted here, nothing up to that line has changed since that checkpoint was posted.
