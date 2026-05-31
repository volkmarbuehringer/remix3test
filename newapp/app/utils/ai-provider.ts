import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { wrapLanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'

let _provider: ReturnType<typeof createOpenAICompatible> | undefined
let _model: ReturnType<typeof wrapLanguageModel> | undefined

function getProvider() {
  if (!_provider) {
    let apiKey = process.env.OPENCODE_API_KEY
    if (!apiKey) {
      throw new Error('OPENCODE_API_KEY environment variable is not set')
    }
    _provider = createOpenAICompatible({
      baseURL: 'https://opencode.ai/zen/go/v1',
      name: 'opencode',
      apiKey,
    })
  }
  return _provider
}

export function getModel() {
  if (!_model) {
    let provider = getProvider()
    _model = wrapLanguageModel({
      model: provider.chatModel('minimax-m2.7'),
      middleware: devToolsMiddleware(),
    })
  }
  return _model
}
