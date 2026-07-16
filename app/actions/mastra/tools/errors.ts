import { z } from 'zod/v4'

export const ErrorCode = z.enum(['VALIDATION', 'NOT_FOUND', 'DEPENDENCY', 'INTERNAL'])

export const errorEnvelope = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCode.describe(
      'Machine-readable error category. Use to determine recovery strategy: VALIDATION=fix input, NOT_FOUND=check reference, DEPENDENCY=retry, INTERNAL=unexpected',
    ),
    message: z.string().describe('Human-readable error description safe to echo to the user'),
  }),
})

export type ErrorCode = z.infer<typeof ErrorCode>

export type ErrorResult = z.infer<typeof errorEnvelope>

export type SuccessResult<T> = { success: true; data: T }

export function successData<T>(data: T): SuccessResult<T> {
  return { success: true as const, data }
}
