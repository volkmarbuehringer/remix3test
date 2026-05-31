---
title: V8 vs. Istanbul Instrumentation
category: concepts
type: context
source: /home/lucky/remix/decisions/004-v8-vs-istanbul-instrumentation.md
tags: [remix3, concepts, design-decisions, testing, coverage]
---

# V8 vs. Istanbul Instrumentation

## Core Concept
Remix 3 uses V8-native coverage collection instead of Istanbul instrumentation for zero runtime overhead. V8's built-in profiler records coverage without modifying source code, while Istanbul requires AST rewriting and counter injection.

## Key Points
- V8 coverage has no runtime performance penalty (built into the engine)
- Istanbul instrumentation slows tests by 20-50% with counter increments
- V8 coverage currently limited to Chromium-based runtimes (Node, Chrome)
- Istanbul would allow Firefox/WebKit coverage but requires heavier transform pipeline
- Revisit Istanbul if non-Chromium coverage becomes a requirement

## Example
```bash
# V8-native coverage (Remix default)
node --test --experimental-test-coverage ./packages/*/src/**/*.test.ts

# Istanbul alternative would require instrumentation step
# istanbul instrument src --output instrumented
```

## Reference
- [V8 Coverage Protocol](https://v8.dev/blog/javascript-code-coverage)
- [Istanbul Instrumenter](https://github.com/istanbuljs/istanbul-lib-instrument)
