# Workflow Agent Confirm Gate

## Problem

The current lock/cancel/unlock flow uses a two-phase tool pattern:

```
cancel_user_workflow_v2(targetUserId, confirmed=false)   → Preflight
→ navigate(/admin/users?filter=...)
→ ask_user("Delete appointments?")
→ cancel_user_workflow_v2(targetUserId, confirmed=true)  → Execute
```

This has three problems:

1. **Confirmed flag im Tool** — Die Bestätigungslogik ist in der Tool-Signatur versteckt, nicht im Gespräch sichtbar. Das Tool hat zwei Modi (Preflight/Ausführung), was die Komplexität erhöht.
2. **Grid ist Mittel zum Zweck** — Die Navigation zum Grid passiert *nach* dem Preflight-Lookup, nicht davor. Der Admin kann das Grid nicht zur Verifikation nutzen, bevor die Entscheidung fällt.
3. **ask_user hat den falschen Fokus** — Statt "Bereit zur Ausführung?" fragt es nach einer technischen Teilentscheidung (Termine löschen?), ohne dem Admin eine echte Pause zur Prüfung zu geben.

## Design

Der neue Flow ist dreiphasig mit einem einzigen menschlichen Gate:

```
Phase 1: Navigation
  navigate(/admin/users?filter=john+doe)
  → Grid zeigt die Suchergebnisse
  → Preflight-Daten (User-Profil, Pending-Counts, Consistency-Checks)
    werden im Kontext der Navigation mitgeliefert
  → KEIN automatischer Tool-Call nach der Navigation

Phase 2: Admin-Pause (das Gate)
  ask_user("Sperrung jetzt durchführen?")
    [Bestätigen] [Abbrechen]
  → Der Admin prüft selbst im Grid, ob der richtige User gefunden wurde
  → Erst wenn der Admin "Bestätigen" klickt, geht es weiter
  → Bei "Abbrechen" endet der Flow sauber

Phase 3: Ausführung
  lock_user_account(targetUserId)
  → Es gibt nur noch einen Modus: Execute
  → Kein confirmed-Flag mehr
  → Tool-Call ist immer die echte Aktion
```

## Was sich ändert

### Tool-Signaturen

- `cancel_user_workflow_v2`, `lock_user_workflow_v2`, `unlock_user_workflow_v2`: **confirmed-Flag entfernt**. Der Tool-Call ist immer die Ausführung.
- Die Preflight-Logik wird in die `navigate`-Response verlagert oder als separater Schritt vor dem ask_user.
- `cancel_user_workflow_v2` braucht `deleteAppointments` als Pflichtfeld (kein Default mehr — der Admin hat vorher im ask_user entschieden, ob Termine gelöscht werden sollen, oder das wird in den Execute-Tool-Call verlagert).

### Agent-Instructions

Der USER FLOW Abschnitt in `workflow-agent.ts` wird ersetzt:

```
ALT (verkürzt):
  Step 1: cancel_user_workflow_v2(targetUserId, confirmed=false)
  Step 2: navigate(...)
  Step 3: ask_user(delete appointments?)
  Step 4: cancel_user_workflow_v2(targetUserId, confirmed=true)

NEU:
  Step 1: navigate(/admin/users?filter=<name>)
  Step 2: ask_user("Sperrung durchführen?", [Bestätigen, Abbrechen])
  Step 3: cancel_user_workflow_v2(targetUserId, deleteAppointments)
```

## Abgrenzung

Diese Change berührt **ausschließlich** den Workflow-Agent-Prompt und die Tool-Signaturen. Nicht berührt:
- Die `cancelUserWorkflow` Mastra Workflow (die Steps validieren, löschen, auditieren, benachrichtigen bleiben)
- Die Grid-Seite selbst
- Der Support-Agent (der nutzt `requireApproval`, nicht diesen Flow)
- Die Preflight-Workflow-Impl

## Risiken

1. **ask_user hängt** — Wenn das ask_user aus irgendeinem Grund nicht answered (UI-Problem, Timeout), kommt der Flow nicht weiter. Ein Timeout-Mechanismus oder eine Abbrechen-Option ist kritisch.
2. **Navigation ohne Tool-Call** — Der Agent muss aus dem navigate()-Resultat die Preflight-Daten (targetUserId, pendingCount, etc.) behalten und bis zum Execute-Tool-Call durchreichen. Da der ask_user dazwischen hängt, muss der Agent die Daten im Working Memory oder im eigenen Kontext halten.
3. **DeleteAppointments-Entscheidung** — Bisher wurde im ask_user gefragt. Künftig muss der Admin entweder vorab sagen "mit/ohne Terminen", oder das deleteAppointments-Flag wird im Execute-Tool-Call mitgegeben (als Pflichtfeld, das der Agent aus dem Kontext ableitet oder vorher per ask_user klärt).
