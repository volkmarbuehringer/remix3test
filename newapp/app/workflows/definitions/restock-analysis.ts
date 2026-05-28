import { registerWorkflow } from '../registry.ts'
import type { Workflow } from '../types.ts'

const restockAnalysisWorkflow: Workflow = async function* (context, params) {
  let { tools, logger, llm } = context

  // Step 1: Get weather for Pirmasens
  yield { id: 'weather', name: 'Getting weather for Pirmasens, Germany', status: 'running' }

  let weatherResult: { temperature: number; humidity: number; windSpeed: number; condition: string; location: string } | undefined
  let weatherError: string | undefined

  let weatherTool = tools['get_weather'] as { execute: (input: { location: string }, options: { toolCallId: string; messages: unknown[] }) => Promise<unknown> } | undefined

  if (weatherTool?.execute) {
    try {
      let result = await weatherTool.execute({ location: 'Pirmasens, Germany' }, { toolCallId: 'test', messages: [] })
      weatherResult = result as typeof weatherResult

      yield {
        id: 'weather',
        name: 'Getting weather for Pirmasens, Germany',
        status: 'completed',
        output: {
          location: weatherResult?.location,
          temperature: weatherResult?.temperature,
          condition: weatherResult?.condition,
          humidity: weatherResult?.humidity,
          windSpeed: weatherResult?.windSpeed,
        },
      }
    } catch (e) {
      weatherError = e instanceof Error ? e.message : String(e)
      yield {
        id: 'weather',
        name: 'Getting weather for Pirmasens, Germany',
        status: 'failed',
        error: weatherError,
      }
    }
  }

  let windSpeed = weatherResult?.windSpeed ?? 0

  // Step 2: Call LLM to analyze weather
  yield { id: 'analyze', name: 'Analyzing weather data with AI', status: 'running' }

  let llmAnalysis = await llm(`Given weather data: ${JSON.stringify(weatherResult)}. Wind speed is ${windSpeed} km/h. Should we list out-of-stock books? Answer yes or no.`)

  yield {
    id: 'analyze',
    name: 'Analyzing weather data with AI',
    status: 'completed',
    output: { analysis: llmAnalysis.slice(0, 200) },
  }

  // Step 3: Check out of stock books only if windSpeed > 2
  if (windSpeed > 2) {
    yield { id: 'check', name: 'Checking out of stock books', status: 'running' }

    let outOfStockBooks = [
      { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
      { id: 2, title: '1984', author: 'George Orwell' },
      { id: 3, title: 'To Kill a Mockingbird', author: 'Harper Lee' },
    ]

    yield {
      id: 'check',
      name: 'Checking out of stock books',
      status: 'completed',
      output: { count: outOfStockBooks.length, books: outOfStockBooks },
    }

    return {
      outOfStockCount: outOfStockBooks.length,
      analysis: `Weather check passed (windSpeed: ${windSpeed} km/h). Found ${outOfStockBooks.length} books that need restocking.`,
      books: outOfStockBooks,
      weather: weatherResult,
      continueWith: 'create-purchase-order',
      continueParams: { books: outOfStockBooks, analysis: 'Weather OK, restocking needed' },
    }
  }

  yield {
    id: 'check',
    name: 'Checking out of stock books',
    status: 'completed',
    output: { message: 'Wind speed too low, skipping restock check', windSpeed },
  }

  return {
    outOfStockCount: 0,
    analysis: `Wind speed (${windSpeed} km/h) is too low to trigger restock check.`,
    weather: weatherResult,
    message: 'Wind speed condition not met',
  }
}

registerWorkflow({
  id: 'restock-analysis',
  name: 'Restock Analysis',
  description: 'Check weather in Pirmasens; if wind > 2 km/h, list out-of-stock books',
  parameters: [],
  tools: ['get_weather'],
  run: restockAnalysisWorkflow,
})
