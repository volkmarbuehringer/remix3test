import { createAsyncStorage } from '../../../utils/async-storage.ts'

export const { runWithId: runWithAdminId, requireId: requireAdminId } = createAsyncStorage('admin')
