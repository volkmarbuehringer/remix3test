/**
 * Copy shared by the server-rendered approval form (no-JS) and the streamed
 * approval card (SSE), so a gate reads identically whichever path rendered it.
 *
 * Extracted from the customer chat stream's `showApproval` when approve/decline
 * became a real native form (vendor guide 09). Change the wording here only.
 */
export interface ToolApprovalCopy {
  title: string
  description: string
}

export function describeToolApproval(
  args?: Record<string, unknown> | null | undefined,
): ToolApprovalCopy {
  let a = args || {}
  if ('appointmentSummary' in a) {
    return { title: 'Termin stornieren?', description: String(a.appointmentSummary ?? '') }
  }
  if ('count' in a || 'appointmentSummaries' in a) {
    return {
      title: String(a.count ?? 0) + ' Termine stornieren?',
      description: (a.appointmentSummaries as string[] | undefined)?.join(', ') ?? '',
    }
  }
  return { title: 'Aktion bestätigen', description: JSON.stringify(a, null, 2) }
}
