# Parallel sessions keep artifacts disjoint

Formerly part of `session-checkpoint-handoff` (now § Checkpoint Handoff in `agent-ops`).

## Unrelated work opens a new session

A request that is not part of the current session's task does **not** belong here — not even a quick one. Fresh sessions are cheap (durable artifacts carry the state), so there is no reason to append unrelated work to a focused session:

- It contaminates the working tree and the eventual commit with changes that do not belong to this task.
- It forces the review/learn step to reason about two unrelated things at once.
- It spends the context budget this session needs to reach its checkpoint.

When an unrelated request arrives, do not "fit it in": open a new session and handle it there. The one exception is a true blocker of the current task — then it is related work by definition.

## Parallel sessions keep artifacts disjoint

A fresh session for unrelated work may run alongside another active session — that is allowed, but never create an artifact that mixes the two. Shared mutable state (the working tree, the index, generated files, shared skills) is the risk, and a checkpoint is exactly when it surfaces:

- **Commits:** stage explicit pathspecs (`git add <your files>`). Never `git add -A` or `git commit -a` while another session may have uncommitted work — that would capture their changes under your message. If both sessions edited the same file, serialize: coordinate before either commits.
- **Formatter / build / generated output:** a repo-wide `format:fix` or generator can rewrite the other session's files. Scope tooling to your own edit set; see the `dev-gotchas § Format Triage` skill for separating formatter noise from real content.
- **Skills, `AGENTS.md`, docs:** only the session whose work produced the lesson writes it. Never capture the parallel session's context into a shared skill.
- **Verification:** typecheck/tests can fail because of the other session's in-flight edits. Verify against your own change and report it, rather than "fixing" their work.
- **Branch / worktree:** prefer a separate branch or worktree per parallel session; at minimum keep every commit's pathspec to your own change.
