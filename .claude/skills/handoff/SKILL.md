---
name: handoff
description: "Hand LiveConsole Ops work between sessions — at the start of a session, load HANDOFF.md and report where things stand; at the end, rewrite it with the current state, decisions and open items and save the durable facts to memory. Use when the user types /handoff, asks to pick up where we left off, or is wrapping up."
---

# Handoff between sessions

This skill runs in one of two directions. Decide which before doing anything:

**Read** — the session has not done any work on this project yet (no commits, no
edits, the user has just arrived), or the user says "pick up", "where were we",
"context le lo", or passes `read`. Go to *Picking up*, at the bottom.

**Write** — work has happened in this session, the user is wrapping up, or they
pass `write`. Continue below.

If it is genuinely ambiguous — work has happened *and* they seem to be starting
over — ask which they want in one line rather than guessing, because writing
destroys the handoff that reading would have used.

---

# Writing the handoff

Two places, because they do different jobs:

- **`HANDOFF.md`** at the repo root — the full picture, read on request.
- **Memory** (`<project memory dir>/`, indexed by `MEMORY.md`) — the few facts
  that must arrive on their own, because the next session loads that index
  without being asked.

Write for the next session, which knows the codebase but nothing about what was
just decided or half-finished. Skip whatever `git log`, `README.md` and the code
already say.

## 1. Gather the real state

```bash
git log --oneline -10
git status --short
git status -sb | head -1
curl -s -o /dev/null -w "site %{http_code}\n" http://live.kriviinfotech.com/
curl -s http://live.kriviinfotech.com/ | grep -o 'assets/index-[^"]*\.js'
```

Confirm what is actually live rather than assuming the last commit is: compare
the live bundle name against `apps/web/dist/assets/`. If they differ, say so —
an undeployed commit is the single most useful thing to hand over.

## 2. Rewrite `HANDOFF.md`

Read the existing file first and carry forward anything still open. Keep these
sections:

- **State right now** — branch, clean or not, latest commit, whether it is live,
  and the shape of the live data.
- **What shipped this session** — a short table of commit and what it did.
- **Rules that changed** — decisions that reverse how the code used to work, so
  the next session treats leftovers as stale rather than as features.
- **Open items** — anything asked and unanswered, offered and not taken up, or
  deliberately left alone. Name who owes the decision.
- **Working notes for this machine** — ports, missing local database, tooling
  that does and does not exist here, what can and cannot be verified.

Every open item needs enough context to act on without this conversation.
"Ask about the untracked files" is useless; name them and say what was offered.

## 3. Update memory

One fact per file, with the frontmatter the session's memory instructions
specify. Update the file that already covers a fact instead of adding a second
one, delete what has turned out wrong, and add the one-line pointer to
`MEMORY.md`.

Memory earns its place only for what is **not** in the repo: client decisions and
their reasons, environment traps, how releases actually reach production, what
the user has told you to do differently. Never copy code structure, commit
history or `README.md` content into it.

## 4. Tell the user how to pick up

Close with: start a new session (or `/clear`), then `/handoff` there loads this
back. Mention that `HANDOFF.md` is untracked unless they have asked for it to be
committed.

---

# Picking up (read mode)

Load the handoff and get oriented before touching anything.

1. **Read `HANDOFF.md`** at the repo root. If it is missing, say so plainly and
   fall back to `git log --oneline -10` plus `README.md` — do not invent state.
2. **Check it is still true**, because it was written at a point in time and the
   repo may have moved since:

   ```bash
   git log --oneline -5
   git status --short
   git status -sb | head -1
   curl -s http://live.kriviinfotech.com/ | grep -o 'assets/index-[^"]*\.js'
   ```

   Compare the live bundle against `apps/web/dist/assets/` and the newest commit
   against what the handoff claims is live. Anything that has drifted is the
   first thing to report.
3. **Report in about ten lines**: where the code stands, what is live, what is
   open and who owes each decision, and any drift found in step 2. The open
   items are the point — the user is deciding what to do next, not reading
   history.
4. **Do not start work.** Finish by asking which open item to pick up, unless
   the user's message already said what they want next.

Treat `HANDOFF.md` as notes from a previous session: useful, but check anything
it says about files, flags or figures before acting on it.
