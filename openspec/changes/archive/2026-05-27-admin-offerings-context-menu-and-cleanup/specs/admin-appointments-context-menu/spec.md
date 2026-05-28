## REMOVED Requirements

### Requirement: Visible action buttons remain for non-right-click users

**Reason**: The context menu pattern is now established across multiple admin pages (nutzer, appointtype, appointments). Users reliably discover right-click actions. The visible buttons consumed horizontal space and created a maintenance burden.

**Migration**: Remove the Edit/Delete glyph button group from each appointments table row. Remove associated CSS mixins (`actionCellStyle`, `btnGroupStyle`, `editBtnStyle`, `delBtnStyle`). The context menu (already implemented) is the sole action mechanism for per-row operations.
