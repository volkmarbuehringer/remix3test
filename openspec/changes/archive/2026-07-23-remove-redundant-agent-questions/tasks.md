## 1. Remove redundant confirmation steps from workflow-agent.ts

- [x] 1.1 Remove Step 2 in USER FLOW (lines 424-427) that tells agent to call ask_user with action as option when intent is already stated
- [x] 1.2 Remove "Confirm cancellation?" ask_user step from cancel protocol (Step 3, line 475)
- [x] 1.3 Remove "Confirm lock?" ask_user step from lock protocol (Step 3, line 486)
- [x] 1.4 Remove "Confirm unlock?" ask_user step from unlock protocol (Step 3, line 495)
- [x] 1.5 Renumber protocol steps after removals so they remain sequential

## 2. Strengthen anti-loop instruction

- [x] 2.1 Replace weak "Do NOT loop — the admin will ask something new" at line 433 with explicit forbidden phrases: "Do NOT ask 'Is there anything else?', 'Any other questions?', or similar. End with the results. The admin types their next request unprompted."

## 3. Preserve the one genuine decision point

- [x] 3.1 Verify the cancel protocol still asks about deleting pending appointments (the ask_user at check_pending_appointments step) — this is the one question that should remain
- [x] 3.2 Verify consistency checks and generate_action_report are still called after execution

## 4. Address targetUserId fragility across tool calls

- [x] 4.1 Add explicit instruction telling the agent to carry targetUserId forward and NEVER re-ask the admin for it
- [ ] 4.2 (Optional) Cache targetUserId in working memory or async storage so the confirmed=true call does not depend on LLM context

## 5. Fix agent reverting to plain text instead of ask_user buttons for ambiguous intent

- [x] 5.1 Add third case in USER FLOW Step 2 for unclear intent: "use ask_user with action options as BUTTONS — do NOT ask in plain text"
- [x] 5.2 Add CRITICAL RULE: "When you need to ask the admin a question, you MUST use the ask_user tool with buttons. Do NOT ask in plain chat text"

## 6. Verify tests pass

- [x] 6.1 Run the test suite to confirm no regressions from instruction changes (1007 pass, 1 pre-existing failure)
- [x] 6.2 Run typecheck to confirm no type errors
