import { createScorer } from '@mastra/core/evals'

export const appointmentCreatedScorer = createScorer({
  id: 'appointment-created',
  description: 'Measures whether an appointment was successfully created',
})
  .generateScore(({ run }) => {
    let output = run.output as { success?: boolean; id?: number; error?: string }
    return output.success ? 1.0 : 0.0
  })
  .generateReason(({ run, score }) => {
    if (score >= 1) {
      let output = run.output as { success?: boolean; id?: number }
      return `Appointment created successfully (id: ${output.id})`
    }
    let output = run.output as { success?: boolean; error?: string }
    return `Failed: ${output.error ?? 'unknown error'}`
  })
