## Context

Der Workflow-Agent (`workflow-agent.ts`) verwendet aktuell ein Zwei-Phasen-Tool-Pattern für Cancel/Lock/Unlock:

```
cancel_user_workflow_v2(targetUserId, confirmed=false)
  → Preflight: User-Daten, Pending-Counts, Consistency-Checks
  → return { found, user, pendingCount, navigate, lockedUsers, ... }

navigate(path)
  → Grid öffnen

ask_user("Delete appointments?")
  → Termin-Entscheidung

cancel_user_workflow_v2(targetUserId, confirmed=true)
  → Ausführung
```

Das `confirmed`-Flag macht das Tool zu einer Zustandsmaschine (Preflight vs. Execute), was die Tool-Signatur verkompliziert und den Agent zwingt, den Zustand über mehrere Tool-Calls zu tragen. Die `navigate`-Action passiert _nach_ dem Preflight, nicht davor — der Admin kann das Grid nicht zur Identifikationsprüfung nutzen.

## Goals / Non-Goals

**Goals:**
- `confirmed`-Flag aus allen Tools entfernen
- Drei-Phasen-Flow: Navigate → Ask_User (Gate) → Execute
- Neues `lookup_user`-Tool als reinen Informationsbeschaffer, ohne Navigations- oder Ausführungs-Seiteneffekte
- Agent-Instructions auf den neuen Flow umschreiben
- Bestehende Mastra-Workflows (`cancelUserWorkflow`, `lockUserWorkflow`, `unlockUserWorkflow`) bleiben unverändert

**Non-Goals:**
- Keine Änderung der Mastra-Workflow-Struktur (Steps, Validierung, Audit-Log, Notification)
- Keine Änderung am Support-Agent (der bleibt bei `requireApproval`)
- Keine Änderung am Grid/UI — das Navigationsziel `/admin/users` bleibt gleich

## Decisions

### Decision 1: Neues `lookup_user`-Tool statt `confirmed=false`

Statt `cancel_user_workflow_v2(targetUserId, confirmed=false)` gibt es ein separates Tool:

**`lookup_user`** (rein lesend, kein requireApproval):
```
Input:  { query: string }  // Name, Email oder ID
Output: {
  found: true,
  users: [{ id, name, email, role, disabledAt, pendingCount, ... }],
  totalPending: number,
  lockedUsers: [...],
  lockedTotal: number,
  activeUsers: [...],
  activeTotal: number,
}
```

Die Preflight-Workflows werden hier aufgerufen. Das Tool hat **keine** Navigations-Seiteneffekte — der Agent navigiert separat.

### Decision 2: Einstufige Execute-Tools statt Zwei-Phasen

`cancel_user_workflow_v2`, `lock_user_workflow_v2`, `unlock_user_workflow_v2` verlieren das `confirmed`-Flag:

```
cancel_user_workflow_v2(targetUserId, deleteAppointments?)
  → Immer Ausführung. Kein Preflight-Zweig mehr.

lock_user_workflow_v2(targetUserId)
  → Immer Ausführung.

unlock_user_workflow_v2(targetUserId)
  → Immer Ausführung.
```

Die Tools akzeptieren `targetUserId` (aus dem `lookup_user`-Ergebnis). `deleteAppointments` bleibt bei Cancel als Pflichtoption (der Agent entscheidet basierend auf Admin-Äußerung oder fragt vorher per `ask_user`).

### Decision 3: Agent-Protocol ist Drei-Phasen

**Neuer Flow für Lock/Cancel/Unlock:**

```
Phase 1 — Lookup + Navigation
  lookup_user({ query: "John Doe" })
    → returns users[], pendingCount, consistency data
  
  navigate({ path: "/admin/users", query: { filter: "John Doe" } })
    → Öffnet Grid im Admin-Frame

Phase 2 — Confirm Gate (ask_user)
  ask_user({ 
    question: "Sperrung jetzt durchführen?", 
    options: [{ label: "Bestätigen" }, { label: "Abbrechen" }] 
  })
  → Agent wird suspendiert. Admin prüft Grid, klickt Bestätigen.

Phase 3 — Execute
  lock_user_workflow_v2({ targetUserId: <id> })
    → Kein confirmed-Flag. Das ist die echte Aktion.
```

### Decision 4: `lookup_user` Results bleiben im Working Memory

Der Agent trägt die `lookup_user`-Ergebnisse (besonders `targetUserId`) im Working Memory. Das ist heute schon der Fall für den Zwei-Phasen-Flow (die Instructions sagen explizit "NEVER ask the admin for the user ID again — you already have it").

Neu: zwischen `lookup_user` und Execute liegt ein `ask_user`-Suspend. Der Working Memory überbrückt diese Pause.

### Decision 5: Support-Agent bleibt unverändert

Der Support-Agent nutzt `requireApproval` (Tool-Approval-Button im UI), nicht den `ask_user`-Gate. Dieses Design betrifft nur den Workflow-Agent, der die Grid-Navigation + Confirm-Gate-Pattern verwendet.

## Risks / Trade-offs

**[Risk] lookup_user kann mehrere Treffer liefern** → Der Agent zeigt alle im Grid und gibt dem Admin die Liste im Chat. Der Admin wählt per ID (oder der Agent zeigt Buttons pro User). Falls nötig: `ask_user` mit den einzelnen User-Optionen als Buttons.

**[Risk] Working Memory Verlust bei ask_user-Suspend** → Mastras Memory mit Working Memory überbrückt Suspensions. Falls der Inhalt verloren geht, muss der Agent `lookup_user` erneut aufrufen (idempotent, kein Schaden). Alternativ: `lookup_user`-Ergebnis in den execute-tool-input kopieren, sodass der Tool-Call selbstgenügsam ist.

**[Risk] ask_user ohne Timeout blockiert Flow** → Der Admin kann immer "Abbrechen" wählen. Bei UI-Problemen (Frame-Neuladung) startet der Agent neu. Kein Silent-Deadlock.

**[Risk] deleteAppointments-Entscheidung** → Bisher im ask_user integriert. Neu: entweder (a) der Admin sagt vorab "mit/ohne Terminen", oder (b) es gibt einen zweiten ask_user nach Bestätigen, oder (c) Cancel akzeptiert `deleteAppointments` als Pflichtfeld, das der Agent aus dem Kontext belegt. Vorschlag: (c) — der Agent leitet aus der Admin-Formulierung ab, ob Termine gelöscht werden sollen, und gibt es explizit im Execute-Tool an.

## Open Questions

- Soll `lookup_user` auch den `routeNavigate`-Teil direkt mitliefern (als `navigate`-Feld im Output)? Dann spart man einen Tool-Call. Nachteil: das Tool bekommt einen Seiteneffekt zurück. — Entscheidung erstmal: nein, sauber trennen.
- Soll `deleteAppointments` im `cancel_user_workflow_v2`-Tool optional bleiben oder Pflicht werden? — Vorschlag: Pflicht. Der Agent muss explizit sagen "ja/nein". Dadurch wird die Absicht dokumentiert.
