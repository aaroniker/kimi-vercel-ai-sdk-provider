# kimi-vercel-ai-sdk-provider

<img width="1500" height="762" alt="git" src="https://github.com/user-attachments/assets/5b8d9be4-5eb7-46f3-9096-56bff8dcda67" />

This is a native implementation with full support for Kimi-specific features, not a generic OpenAI-compatible wrapper.

[![npm version](https://img.shields.io/npm/v/kimi-vercel-ai-sdk-provider.svg?style=flat-square)](https://www.npmjs.com/package/kimi-vercel-ai-sdk-provider) 
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/kimi-vercel-ai-sdk-provider?style=flat-square&label=bundle%20size)](https://bundlephobia.com/package/kimi-vercel-ai-sdk-provider)
[![npm downloads](https://img.shields.io/npm/dm/kimi-vercel-ai-sdk-provider.svg?style=flat-square)](https://www.npmjs.com/package/kimi-vercel-ai-sdk-provider)
[![license](https://img.shields.io/npm/l/kimi-vercel-ai-sdk-provider.svg?style=flat-square)](https://github.com/aaroniker/kimi-vercel-ai-sdk-provider/blob/main/LICENSE)

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Quick Start](#quick-start)
- [Kimi Code](#kimi-code)
  - [Available Models](#available-models)
  - [Extended Thinking](#extended-thinking)
  - [Streaming with Thinking Blocks](#streaming-with-thinking-blocks)
- [Built-in Tools](#built-in-tools-kimi-chat)
  - [Web Search](#web-search-web_search)
  - [Code Interpreter](#code-interpreter-code)
  - [Provider Tool Helpers](#provider-tool-helpers)
- [Native File & PDF Support](#native-file--pdf-support)
  - [File Client](#file-client-simple)
  - [Attachment Processing](#attachment-processing)
  - [Supported File Types](#supported-file-types)
- [Tool Choice Polyfill](#tool-choice-polyfill)
- [Context Caching](#context-caching)
- [Token Tracking](#token-tracking)
- [Reasoning/Thinking Models](#reasoningthinking-models)
- [Video Input](#video-input-k25-models)
- [Model Capabilities](#model-capabilities)
- [Advanced Features](#advanced-features)
  - [Auto-Detect Tools](#auto-detect-tools)
  - [Ensemble Generation](#ensemble-generation-multi-sampling)
  - [Code Validation](#code-validation)
  - [Multi-Agent Collaboration](#multi-agent-collaboration)
  - [Project Scaffolding](#project-scaffolding)
  - [Temperature Locking](#temperature-locking-for-thinking-models)
  - [File Content Caching](#file-content-caching)
  - [Schema Sanitization](#schema-sanitization)
  - [Reasoning Preservation](#reasoning-preservation-utilities)
- [Provider Options](#provider-options)
- [Available Models](#available-models-1)
- [Regional Endpoints](#regional-endpoints)
- [Environment Variables](#environment-variables)
- [Why Native vs OpenAI-Compatible?](#why-native-vs-openai-compatible)
- [API Reference](#api-reference)
- [License](#license)

## Features

### Kimi Chat (Standard API)
- Built-in web search (`$web_search`) for grounded responses
- Built-in code interpreter (`$code`) for programmatic reasoning
- Deep thinking/reasoning model streaming
- Video input support for K2.5 models
- 256k context window support
- Token tracking (cache hits, reasoning, web search, code interpreter)
- Regional endpoints (global and China)
- Provider tool helpers (`kimi.tools.*` and `kimiTools.*`)
- **Native File & PDF Support** - Automatic file upload and content extraction
- **Tool Choice Polyfill** - Simulates `required` and `tool` choices via system messages
- **Context Caching** - Reduce costs by up to 90% for repeated long prompts
- **Temperature Locking** - Automatic temperature enforcement for thinking models
- **File Content Caching** - LRU cache to avoid re-uploading identical files
- **Schema Sanitization** - Automatic cleanup of unsupported JSON Schema keywords

### Kimi Code (Premium Coding API)
- High-speed output (up to 100 tokens/s)
- Extended thinking/reasoning support with configurable effort levels
- 262k context window
- Streaming with thinking blocks

## Install

```bash
npm install kimi-vercel-ai-sdk-provider
```

## Quick Start

### Kimi Chat (Standard)

```ts
import { createKimi } from 'kimi-vercel-ai-sdk-provider';
import { generateText, streamText } from 'ai';

const kimi = createKimi({
  // Uses MOONSHOT_API_KEY env var if not provided
  endpoint: 'global',
});

// Basic usage
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Explain quantum computing in one sentence.',
});

// Streaming with reasoning model
const stream = await streamText({
  model: kimi('kimi-k2.5-thinking', { includeUsageInStream: true }),
  prompt: 'Solve this step by step: What is 17 * 23?',
});
```

### Kimi Code (Premium)

```ts
import { kimiCode, createKimiCode } from 'kimi-vercel-ai-sdk-provider
';
import { generateText, streamText } from 'ai';

// Using default instance (uses KIMI_CODE_API_KEY or KIMI_API_KEY env var)
const result = await generateText({
  model: kimiCode(), // Uses 'kimi-for-coding' by default
  prompt: 'Write a TypeScript function to merge two sorted arrays',
});

// With extended thinking enabled
const stream = await streamText({
  model: kimiCode('kimi-k2-thinking', {
    extendedThinking: {
      enabled: true,
      effort: 'high' // 'low' | 'medium' | 'high'
    }
  }),
  prompt: 'Design a distributed cache system',
});

// Or with custom configuration
const customKimiCode = createKimiCode({
  apiKey: 'sk-kimi-xxx',
  baseURL: 'https://api.kimi.com/coding/v1', // default
});
```

## Kimi Code

Kimi Code is a premium coding service optimized for development tasks with high-speed output and extended thinking support.

### Available Models

| Model | Description |
|-------|-------------|
| `kimi-for-coding` | Primary coding model optimized for development tasks (default) |
| `kimi-k2-thinking` | Extended thinking model for complex reasoning |

### Extended Thinking

Enable extended thinking to see the model's reasoning process:

```ts
// Simple boolean
const model = kimiCode('kimi-for-coding', { extendedThinking: true });

// With effort level
const model = kimiCode('kimi-for-coding', {
  extendedThinking: {
    enabled: true,
    effort: 'high' // 'low' (~2k tokens), 'medium' (~8k tokens), 'high' (~16k tokens)
  }
});

// With explicit budget
const model = kimiCode('kimi-for-coding', {
  extendedThinking: {
    enabled: true,
    budgetTokens: 10000
  }
});
```

### Provider Options

Pass options via `providerOptions.kimiCode`:

```ts
const result = await generateText({
  model: kimiCode('kimi-for-coding'),
  prompt: 'Write a REST API',
  providerOptions: {
    kimiCode: {
      extendedThinking: { enabled: true, effort: 'medium' },
      system: 'You are an expert TypeScript developer',
      stopSequences: ['```']
    }
  }
});
```

### Streaming with Thinking Blocks

```ts
const stream = await streamText({
  model: kimiCode('kimi-k2-thinking'),
  prompt: 'Design a microservices architecture',
});

for await (const part of stream.fullStream) {
  switch (part.type) {
    case 'reasoning-start':
      console.log('--- Thinking ---');
      break;
    case 'reasoning-delta':
      process.stdout.write(part.delta);
      break;
    case 'reasoning-end':
      console.log('\n--- Answer ---');
      break;
    case 'text-delta':
      process.stdout.write(part.delta);
      break;
  }
}
```

## Built-in Tools (Kimi Chat)

Kimi provides server-side tools that can be enabled in three ways:

1. Model settings: `kimi('model', { webSearch: true })`
2. Provider options: `providerOptions.kimi.webSearch = true`
3. Provider tool helpers: `kimi.tools.webSearch()` or `kimiTools.webSearch()`

### Web Search (`$web_search`)

```ts
// Enable via model settings
const model = kimi('kimi-k2.5', { webSearch: true });

const result = await generateText({
  model,
  prompt: 'What are the latest AI news today?',
});

// Enable per request via provider options
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'What is the current Bitcoin price?',
  providerOptions: {
    kimi: {
      webSearch: true,
    },
  },
});

// Advanced: Configure search behavior
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Latest research on transformer architectures',
  providerOptions: {
    kimi: {
      webSearch: {
        enabled: true,
        config: {
          search_result: true,
        },
      },
    },
  },
});
```

### Code Interpreter (`$code`)

```ts
// Enable via model settings
const model = kimi('kimi-k2.5', { codeInterpreter: true });

const result = await generateText({
  model,
  prompt: 'Calculate the factorial of 20 and show your work.',
});

// Enable per request via provider options
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Simulate 1000 coin flips and report the distribution.',
  providerOptions: {
    kimi: {
      codeInterpreter: true,
    },
  },
});

// Advanced: Configure code execution
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Generate a CSV of prime numbers under 1000.',
  providerOptions: {
    kimi: {
      codeInterpreter: {
        enabled: true,
        config: {
          timeout: 30,
          include_output: true,
        },
      },
    },
  },
});
```

### Provider Tool Helpers

```ts
import { kimi, kimiTools } from 'kimi-vercel-ai-sdk-provider
';

const result = await generateText({
  model: kimi('kimi-k2.5'),
  tools: {
    webSearch: kimi.tools.webSearch(),
    codeInterpreter: kimi.tools.codeInterpreter(),
  },
  prompt: 'Summarize today\'s headlines and compute sentiment stats.',
});

// Or use the named helper
const result = await generateText({
  model: kimi('kimi-k2.5'),
  tools: {
    webSearch: kimiTools.webSearch(),
  },
  prompt: 'What is the weather in Tokyo?',
});
```

## Native File & PDF Support

Kimi excels at reading long documents. This provider includes a file handling module for automatic file upload and content extraction.

### File Client (Simple)

The provider includes a pre-configured file client:

```ts
import { createKimi } from 'kimi-vercel-ai-sdk-provider
';

const kimi = createKimi();

// Upload and extract content from a PDF - no config needed!
const result = await kimi.files.uploadAndExtract({
  data: pdfBuffer,
  filename: 'document.pdf',
});

console.log(result.content); // Extracted text content
console.log(result.file.id); // File ID for reference

// List all uploaded files
const files = await kimi.files.listFiles();

// Delete a file
await kimi.files.deleteFile(fileId);
```

### File Client (Manual Configuration)

If you need custom configuration:

```ts
import { KimiFileClient } from 'kimi-vercel-ai-sdk-provider
';

const client = new KimiFileClient({
  baseURL: 'https://api.moonshot.ai/v1',
  headers: () => ({
    Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
  }),
});

const result = await client.uploadAndExtract({
  data: pdfBuffer,
  filename: 'document.pdf',
  mediaType: 'application/pdf',
});
```

### Attachment Processing

Process experimental_attachments automatically:

```ts
import { processAttachments } from 'kimi-vercel-ai-sdk-provider
';

const processed = await processAttachments({
  attachments: message.experimental_attachments ?? [],
  clientConfig: {
    baseURL: 'https://api.moonshot.ai/v1',
    headers: () => ({ Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}` }),
  },
  autoUploadDocuments: true,
  cleanupAfterExtract: true, // Delete files after extraction
});

// Inject document content into messages
const documentContent = processed
  .filter(p => p.type === 'text-inject' && p.textContent)
  .map(p => p.textContent)
  .join('\n');
```

### Supported File Types

Documents (extracted as text): PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, HTML, JSON, EPUB, CSV, and code files.

Images (for vision): JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, AVIF.

Videos (K2.5 models): MP4, WebM, OGG.

## Tool Choice Polyfill

Kimi doesn't natively support `tool_choice: 'required'` or forcing a specific tool. This provider includes a polyfill that uses system message injection to simulate these behaviors.

### Automatic Polyfill (Default)

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  tools: { searchWeb: webSearchTool },
  toolChoice: { type: 'required' }, // Polyfilled automatically
  prompt: 'Find the weather in Tokyo',
});
```

The provider will inject a system message like:
> "IMPORTANT INSTRUCTION: You MUST use one of the available tools to respond..."

### Disable Polyfill

```ts
// Disable via model settings
const model = kimi('kimi-k2.5', { toolChoicePolyfill: false });

// Or per-request via provider options
const result = await generateText({
  model: kimi('kimi-k2.5'),
  tools: { searchWeb: webSearchTool },
  toolChoice: { type: 'required' },
  providerOptions: {
    kimi: { toolChoicePolyfill: false }
  },
  prompt: 'Find the weather',
});
```

## Context Caching

Reduce costs by up to 90% for repeated long prompts (like analyzing documents or maintaining long conversations).

### Enable Caching

```ts
// Simple boolean
const result = await generateText({
  model: kimi('kimi-k2.5', { caching: true }),
  prompt: 'Analyze this long document...',
});

// With configuration
const result = await generateText({
  model: kimi('kimi-k2.5', {
    caching: {
      enabled: true,
      cacheKey: 'book-analysis-v1', // Consistent key for cache hits
      ttlSeconds: 7200, // 2 hours TTL
    }
  }),
  prompt: 'What are the main themes?',
});
```

### Per-Request Caching

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Continue analysis...',
  providerOptions: {
    kimi: {
      caching: {
        enabled: true,
        cacheKey: 'book-analysis-v1',
      }
    }
  },
});
```

### Reset Cache

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Re-analyze with new context...',
  providerOptions: {
    kimi: {
      caching: {
        enabled: true,
        cacheKey: 'book-analysis-v1',
        resetCache: true, // Force cache refresh
      }
    }
  },
});
```

## Token Tracking

Token usage includes built-in tool usage when present:

```ts
const result = await generateText({
  model: kimi('kimi-k2.5', { webSearch: true, codeInterpreter: true }),
  prompt: 'Find today\'s EUR/USD rate and compute a 5% increase.',
});

console.log(result.usage);
// {
//   inputTokens: { total: 150, cacheRead: 50, ... },
//   outputTokens: { total: 200, reasoning: 0, ... },
//   webSearchTokens: 1500,
//   codeInterpreterTokens: 320,
// }
```

## Reasoning/Thinking Models

Kimi's thinking models provide step-by-step reasoning:

```ts
const stream = await streamText({
  model: kimi('kimi-k2.5-thinking'),
  prompt: 'Prove that sqrt(2) is irrational.',
});

for await (const part of stream.fullStream) {
  switch (part.type) {
    case 'reasoning-start':
      console.log('--- Reasoning ---');
      break;
    case 'reasoning-delta':
      process.stdout.write(part.delta);
      break;
    case 'reasoning-end':
      console.log('\n--- Answer ---');
      break;
    case 'text-delta':
      process.stdout.write(part.delta);
      break;
  }
}
```

## Video Input (K2.5 models)

K2.5 models support video URLs:

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is happening in this video?' },
        {
          type: 'file',
          mediaType: 'video/mp4',
          data: new URL('https://example.com/video.mp4'),
        },
      ],
    },
  ],
});
```

## Model Capabilities

The provider automatically infers capabilities from model IDs:

```ts
import { inferModelCapabilities, inferKimiCodeCapabilities } from 'kimi-vercel-ai-sdk-provider
';

// Kimi Chat models
const caps = inferModelCapabilities('kimi-k2.5-thinking');
// {
//   thinking: true,
//   alwaysThinking: true,
//   imageInput: true,
//   videoInput: true,
//   maxContextSize: 256000,
//   toolCalling: true,
//   jsonMode: true,
//   structuredOutputs: true,
// }

// Kimi Code models
const codeCaps = inferKimiCodeCapabilities('kimi-k2-thinking');
// {
//   extendedThinking: true,
//   maxOutputTokens: 32768,
//   maxContextSize: 262144,
//   streaming: true,
//   toolCalling: true,
//   imageInput: true,
// }
```

## Advanced Features

### Auto-Detect Tools

Automatically detect which built-in tools should be enabled based on prompt content:

```ts
import { kimi, detectToolsFromPrompt, shouldAutoEnableTools } from 'kimi-vercel-ai-sdk-provider';

// Simple detection
const tools = kimi.detectTools('What is the current Bitcoin price?');
// { webSearch: true, codeInterpreter: false }

// Use with model settings
const model = kimi('kimi-k2.5', {
  webSearch: tools.webSearch,
  codeInterpreter: tools.codeInterpreter
});

// Or use the standalone function with more details
const result = detectToolsFromPrompt('Calculate the factorial of 20');
// {
//   webSearch: false,
//   codeInterpreter: true,
//   webSearchConfidence: 0,
//   codeInterpreterConfidence: 0.9,
//   webSearchMatches: [],
//   codeInterpreterMatches: ['calculate']
// }

// Check for opt-outs
import { hasToolOptOut } from 'kimi-vercel-ai-sdk-provider';
const optOut = hasToolOptOut("Don't search the web, just answer from memory");
// { webSearch: true, codeInterpreter: false }
```

### Ensemble Generation (Multi-Sampling)

Generate multiple responses and select the best one using various strategies:

```ts
import { kimi, MultiSampler } from 'kimi-vercel-ai-sdk-provider';
import { generateText } from 'ai';

// Using the provider convenience method
const result = await kimi.ensemble(
  'Write a function to merge two sorted arrays',
  async (model, prompt, options) => {
    const result = await generateText({
      model,
      prompt,
      temperature: options?.temperature
    });
    return { text: result.text, usage: result.usage };
  },
  {
    n: 3,                          // Generate 3 samples
    selectionStrategy: 'best',     // 'first' | 'vote' | 'best' | 'all'
    scoringHeuristic: 'code',      // 'length' | 'confidence' | 'code' | 'custom'
    temperatureVariance: 0.1,      // Add variance for diversity
    model: 'kimi-k2.5',
  }
);

console.log(result.text);           // Best response
console.log(result.metadata);       // { nRequested: 3, nCompleted: 3, winningIndex: 1, ... }
console.log(result.alternatives);   // All responses (when strategy is 'all')

// Or use MultiSampler directly for more control
const sampler = new MultiSampler({
  generateFn: async (model, prompt, options) => {
    const result = await generateText({ model, prompt, temperature: options?.temperature });
    return { text: result.text };
  },
  modelId: 'kimi-k2.5'
});

const ensembleResult = await sampler.generate(
  kimi('kimi-k2.5'),
  'Explain quantum computing',
  {
    n: 5,
    selectionStrategy: 'vote',     // Majority voting
    timeoutMs: 30000,
    allowPartialFailure: true,
    minSuccessfulSamples: 2
  }
);

// Custom scoring function
const customResult = await sampler.generate(
  kimi('kimi-k2.5'),
  'Write clean code',
  {
    n: 3,
    selectionStrategy: 'best',
    scoringHeuristic: 'custom',
    customScorer: (response) => {
      // Higher score = better
      let score = 0;
      if (response.text.includes('```')) score += 10;
      if (response.text.length > 500) score += 5;
      if (!response.text.includes('TODO')) score += 3;
      return score;
    }
  }
);
```

### Code Validation

Validate generated code for syntax errors and common issues:

```ts
import { kimi, CodeValidator, detectLanguage, extractCodeBlocks } from 'kimi-vercel-ai-sdk-provider';
import { generateText } from 'ai';

// Using the provider convenience method
const result = await kimi.validateCode(
  `function add(a, b) {
    return a + b
  }`,
  async (model, prompt) => {
    const result = await generateText({ model, prompt });
    return { text: result.text };
  },
  {
    language: 'javascript',
    strictness: 'normal',  // 'lenient' | 'normal' | 'strict'
    autoFix: true,
    maxAttempts: 3
  }
);

console.log(result.valid);      // true/false
console.log(result.errors);     // Array of validation errors
console.log(result.fixedCode);  // Auto-fixed code (if autoFix enabled)

// Language detection
const langResult = detectLanguage(`
  def hello():
    print("Hello, World!")
`);
// { language: 'python', confidence: 0.9, indicators: ['def', 'print'] }

// Extract code blocks from markdown
const blocks = extractCodeBlocks(`
Here's the code:

\`\`\`typescript
const x: number = 42;
\`\`\`
`);
// { blocks: [{ code: 'const x: number = 42;', language: 'typescript', ... }], hasCode: true }

// Direct validator usage
const validator = new CodeValidator({
  generateText: async (prompt) => {
    const result = await generateText({ model: kimi('kimi-k2.5'), prompt });
    return { text: result.text };
  }
});

const validation = await validator.validate(code, {
  language: 'typescript',
  strictness: 'strict',
  autoFix: true,
  validateWithLLM: true,  // Use LLM for semantic validation
  maxAttempts: 2
});
```

### Multi-Agent Collaboration

Use multiple agents working together for complex tasks:

```ts
import { kimi, WorkflowRunner, DEFAULT_SYSTEM_PROMPTS } from 'kimi-vercel-ai-sdk-provider';
import { generateText } from 'ai';

// Using the provider convenience method
const result = await kimi.multiAgent(
  'Build a REST API for user authentication with JWT',
  async (modelId, prompt, systemPrompt) => {
    const result = await generateText({
      model: kimi(modelId),
      prompt,
      system: systemPrompt
    });
    return { text: result.text, reasoning: result.reasoning };
  },
  {
    workflow: 'planner-executor',  // 'planner-executor' | 'proposer-critic' | 'debate' | 'custom'
    modelA: 'kimi-k2.5-thinking',  // Planning/thinking agent
    modelB: 'kimi-k2.5',           // Execution agent
    iterations: 2,
    validateCode: true,
    verbose: true
  }
);

console.log(result.text);               // Final output
console.log(result.reasoning);          // Planning/reasoning output
console.log(result.intermediateSteps);  // All steps in the workflow
console.log(result.metadata);           // { workflow: 'planner-executor', iterations: 2, ... }

// Different workflow types:

// 1. Planner-Executor: One agent plans, another implements
const plannerExecutor = await kimi.multiAgent(prompt, generateFn, {
  workflow: 'planner-executor'
});

// 2. Proposer-Critic: Iterative refinement with feedback
const proposerCritic = await kimi.multiAgent(prompt, generateFn, {
  workflow: 'proposer-critic',
  iterations: 3  // Number of refinement cycles
});

// 3. Debate: Multiple perspectives converge on answer
const debate = await kimi.multiAgent(prompt, generateFn, {
  workflow: 'debate'
});

// 4. Custom workflow
const custom = await kimi.multiAgent(prompt, generateFn, {
  workflow: 'custom',
  customWorkflow: async (prompt, context) => {
    // Step 1: Research
    const research = await context.generateWithModelA(
      `Research: ${prompt}`
    );
    context.addStep({ agent: 'A', role: 'custom', action: 'research', output: research.text });

    // Step 2: Implement
    const implementation = await context.generateWithModelB(
      `Based on research:\n${research.text}\n\nImplement: ${prompt}`
    );
    context.addStep({ agent: 'B', role: 'custom', action: 'implement', output: implementation.text });

    return {
      text: implementation.text,
      reasoning: research.text,
      intermediateSteps: [],  // Filled by context
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { workflow: 'custom', iterations: 2, durationMs: 0, models: [], validationEnabled: false, success: true }
    };
  }
});

// Custom system prompts
const withCustomPrompts = await kimi.multiAgent(prompt, generateFn, {
  workflow: 'proposer-critic',
  systemPrompts: {
    proposer: 'You are a senior software architect. Propose clean, maintainable solutions.',
    critic: 'You are a security expert. Review for vulnerabilities and suggest improvements.'
  }
});
```

### Project Scaffolding

Generate complete project structures from descriptions:

```ts
import { kimi, ProjectScaffolder } from 'kimi-vercel-ai-sdk-provider';
import { generateText } from 'ai';

// Using the provider convenience method
const result = await kimi.scaffoldProject(
  'A Next.js app with authentication, database, and API routes',
  async (prompt) => {
    const result = await generateText({ model: kimi('kimi-k2.5'), prompt });
    return { text: result.text };
  },
  {
    type: 'nextjs',         // 'auto' | 'nextjs' | 'react' | 'vue' | 'node' | 'express' | 'fastify' | 'python' | 'fastapi' | 'flask' | 'go' | 'rust'
    includeTests: true,     // Include test files
    includeCI: true,        // Include GitHub Actions
    includeDocs: true,      // Include README
    includeDocker: true,    // Include Dockerfile
    includeLinting: true,   // Include ESLint config
    useTypeScript: true,
    features: ['auth', 'database', 'api'],
    outputFormat: 'files'   // 'files' | 'instructions' | 'json'
  }
);

console.log(result.files);          // Array of { path, content, description }
console.log(result.instructions);   // Setup instructions markdown
console.log(result.setupCommands);  // ['npm install', 'npm run dev', ...]
console.log(result.metadata);       // { projectType, projectName, fileCount, ... }

// Write files to disk
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';

for (const file of result.files) {
  const filePath = join('./my-project', file.path);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, file.content);
}

// Or use the scaffolder directly
const scaffolder = new ProjectScaffolder({
  generateText: async (prompt) => {
    const result = await generateText({ model: kimi('kimi-k2.5'), prompt });
    return { text: result.text };
  }
});

const project = await scaffolder.scaffold(
  'A REST API with Express and MongoDB',
  {
    type: 'express',
    includeTests: true,
    customTemplate: `
      Must include:
      - JWT authentication middleware
      - Request validation with Zod
      - Error handling middleware
      - Rate limiting
    `
  }
);
```

### Temperature Locking for Thinking Models

Thinking models like `kimi-k2.5-thinking` require a fixed temperature of `1.0` for optimal reasoning. The provider automatically enforces this:

```ts
// Temperature is automatically set to 1.0 for thinking models
const result = await generateText({
  model: kimi('kimi-k2.5-thinking'),
  temperature: 0.7, // Will be ignored with a warning
  prompt: 'Solve this complex problem...',
});

// Check the response for warnings
console.log(result.warnings);
// [{ type: 'compatibility', feature: 'temperature', details: 'Thinking models require temperature=1.0...' }]
```

Thinking models also default to 32k max tokens to prevent reasoning truncation:

```ts
// No need to set maxTokens - defaults to 32768 for thinking models
const result = await generateText({
  model: kimi('kimi-k2.5-thinking'),
  prompt: 'Explain quantum computing in detail...',
});
```

### File Content Caching

Avoid re-uploading the same files by enabling the LRU cache:

```ts
import { processAttachments } from 'kimi-vercel-ai-sdk-provider';

// Enable caching (uses default global cache: 100 entries, 1 hour TTL)
const processed = await processAttachments({
  attachments: message.experimental_attachments ?? [],
  clientConfig: {
    baseURL: 'https://api.moonshot.ai/v1',
    headers: () => ({ Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}` }),
  },
  cache: true, // Enable file caching
});

// Or provide a custom cache instance
import { FileCache } from 'kimi-vercel-ai-sdk-provider';

const customCache = new FileCache({
  maxSize: 200,      // Max 200 entries
  ttlMs: 2 * 60 * 60 * 1000, // 2 hour TTL
});

const processed = await processAttachments({
  attachments,
  clientConfig,
  cache: customCache,
});
```

### Schema Sanitization

Tool parameters are automatically sanitized to remove JSON Schema keywords not supported by Kimi:

```ts
// This schema with advanced JSON Schema features...
const complexTool = {
  name: 'search',
  parameters: z.object({
    query: z.string(),
    filters: z.object({
      $schema: 'http://json-schema.org/draft-07/schema#', // Removed
      allOf: [{ minLength: 1 }], // Removed
      anyOf: [{ type: 'string' }], // Removed
    }),
  }),
};

// ...is automatically sanitized before being sent to Kimi
// Only basic properties (type, properties, required, description) are kept
```

### Reasoning Preservation Utilities

Helpers for maintaining reasoning context in multi-turn conversations:

```ts
import { 
  analyzeReasoningPreservation, 
  recommendThinkingModel 
} from 'kimi-vercel-ai-sdk-provider';

// Analyze if reasoning is properly preserved in a conversation
const messages = [
  { role: 'user', content: 'Solve this step by step: ...' },
  { 
    role: 'assistant', 
    content: [
      { type: 'reasoning', text: 'First, I need to...' },
      { type: 'text', text: 'The answer is 42.' }
    ]
  },
  { role: 'user', content: 'Explain step 2 more.' },
];

const analysis = analyzeReasoningPreservation(messages);
// {
//   hasReasoningContent: true,
//   reasoningPreserved: true,
//   turnCount: 3,
//   reasoningTurnCount: 1,
//   recommendations: []
// }

// Get a recommendation on whether to use a thinking model
const recommendation = recommendThinkingModel({
  taskDescription: 'Complex mathematical proof',
  requiresStepByStep: true,
  complexity: 'high',
});
// {
//   recommended: true,
//   reason: 'Task requires step-by-step reasoning with high complexity',
//   suggestedModel: 'kimi-k2.5-thinking'
// }
```

## Provider Options

### Kimi Chat Options

Pass Kimi-specific options via `providerOptions.kimi`:

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Return JSON with name and version.',
  responseFormat: { type: 'json' },
  providerOptions: {
    kimi: {
      user: 'user-123',
      requestId: 'trace-abc',
      strictJsonSchema: true,
      extraHeaders: { 'X-Custom': 'value' },
      parallelToolCalls: true,
      webSearch: true,
      codeInterpreter: true,
    },
  },
});
```

### Kimi Code Options

Pass options via `providerOptions.kimiCode`:

```ts
const result = await generateText({
  model: kimiCode('kimi-for-coding'),
  prompt: 'Write clean code',
  providerOptions: {
    kimiCode: {
      extendedThinking: { enabled: true, effort: 'medium' },
      system: 'Follow best practices',
      stopSequences: ['---'],
    },
  },
});
```

## Available Models

### Kimi Chat

| Model | Features |
|-------|----------|
| `kimi-k2.5` | Latest, image/video input, built-in tools |
| `kimi-k2.5-thinking` | K2.5 + always-on deep reasoning |
| `kimi-k2-turbo` | Fast, cost-effective |
| `kimi-k2-thinking` | K2 + always-on deep reasoning |

### Kimi Code

| Model | Features |
|-------|----------|
| `kimi-for-coding` | Primary coding model (default) |
| `kimi-k2-thinking` | Extended thinking for complex tasks |

## Regional Endpoints

### Kimi Chat

```ts
// Global (default) - api.moonshot.ai
const kimiGlobal = createKimi({ endpoint: 'global' });

// China - api.moonshot.cn (lower latency in mainland China)
const kimiChina = createKimi({ endpoint: 'cn' });

// Custom endpoint
const kimiCustom = createKimi({
  baseURL: 'https://your-proxy.example.com/v1',
});
```

### Kimi Code

```ts
// Default - api.kimi.com/coding/v1
const codeProvider = createKimiCode();

// Custom endpoint
const customCodeProvider = createKimiCode({
  baseURL: 'https://your-proxy.example.com/v1',
});
```

## Environment Variables

Copy `.env.example` to `.env` and configure your API keys:

```bash
cp .env.example .env
```

### Kimi Chat
| Variable | Description |
|----------|-------------|
| `MOONSHOT_API_KEY` | Your Moonshot AI API key (required) |
| `MOONSHOT_BASE_URL` | Override the base URL (optional) |

### Kimi Code
| Variable | Description |
|----------|-------------|
| `KIMI_CODE_API_KEY` | Your Kimi Code API key (preferred) |
| `KIMI_API_KEY` | Fallback API key if `KIMI_CODE_API_KEY` not set |
| `KIMI_CODE_BASE_URL` | Override the base URL (optional) |

Get your API keys at: https://platform.moonshot.cn/console/api-keys

## Why Native vs OpenAI-Compatible?

This provider is built natively for Kimi rather than using `@ai-sdk/openai-compatible`. Benefits:

| Feature | Native Provider | OpenAI-Compatible |
|---------|-----------------|-------------------|
| `$web_search` built-in tool | Full support | Not available |
| `$code` code interpreter | Full support | Not available |
| Built-in tool token tracking | Included | Not available |
| Video input support | Automatic | Manual config |
| Reasoning content streaming | Native handling | May need config |
| Model capability inference | Automatic | Manual |
| Type-safe provider options | Full types | Partial |
| Error messages | Kimi-specific | Generic |
| Kimi Code extended thinking | Full support | Not available |

## API Reference

### Exports

```ts
// Kimi Chat Provider
import {
  createKimi,
  kimi,
  KimiChatLanguageModel,
  inferModelCapabilities,
  kimiProviderOptionsSchema,
  kimiCachingConfigSchema,
  kimiTools,
  // Types
  KimiProvider,
  KimiProviderSettings,
  KimiChatSettings,
  KimiChatModelId,
  KimiProviderOptions,
  KimiModelCapabilities,
  KimiCachingConfig,
  EnsembleOptions,
  MultiAgentOptions,
  ValidateCodeOptions,
  ScaffoldProjectOptions,
} from 'kimi-vercel-ai-sdk-provider';

// Kimi Code Provider
import {
  createKimiCode,
  kimiCode,
  KimiCodeLanguageModel,
  inferKimiCodeCapabilities,
  kimiCodeProviderOptionsSchema,
  // Constants
  KIMI_CODE_BASE_URL,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_THINKING_MODEL,
  // Types
  KimiCodeProvider,
  KimiCodeProviderSettings,
  KimiCodeSettings,
  KimiCodeModelId,
  KimiCodeCapabilities,
  ExtendedThinkingConfig,
  ReasoningEffort,
} from 'kimi-vercel-ai-sdk-provider';

// File Handling
import {
  KimiFileClient,
  processAttachments,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  isImageMediaType,
  isVideoMediaType,
  isDocumentMediaType,
  isFileExtractMediaType,
  getMediaTypeFromExtension,
  getPurposeFromMediaType,
  // Types
  KimiFile,
  KimiFileClientConfig,
  FileUploadOptions,
  FileUploadResult,
  Attachment,
  ProcessedAttachment,
} from 'kimi-vercel-ai-sdk-provider';

// Auto-Detect Tools
import {
  detectToolsFromPrompt,
  shouldAutoEnableTools,
  hasToolOptOut,
  generateToolGuidanceMessage,
  // Types
  AutoDetectToolsResult,
  AutoDetectConfig,
  ToolGuidanceOptions,
} from 'kimi-vercel-ai-sdk-provider';

// Ensemble / Multi-Sampling
import {
  MultiSampler,
  createSingletonEnsembleResult,
  // Types
  EnsembleConfig,
  EnsembleResult,
  EnsembleResponse,
  EnsembleMetadata,
  SelectionStrategy,
  ScoringHeuristic,
  GenerateFunction,
  MultiSamplerOptions,
} from 'kimi-vercel-ai-sdk-provider';

// Code Validation
import {
  CodeValidator,
  detectLanguage,
  extractCodeBlocks,
  extractPrimaryCode,
  containsCode,
  getFileExtension,
  createPassedValidationResult,
  createFailedValidationResult,
  // Types
  CodeValidationConfig,
  ValidationResult,
  ValidationError,
  ValidationErrorType,
  ValidationSeverity,
  ValidationStrictness,
  SupportedLanguage,
  LanguageDetectionResult,
  CodeBlock,
  CodeExtractionResult,
  CodeValidatorOptions,
  FixAttempt,
} from 'kimi-vercel-ai-sdk-provider';

// Multi-Agent Collaboration
import {
  WorkflowRunner,
  createEmptyMultiAgentResult,
  DEFAULT_SYSTEM_PROMPTS,
  // Types
  MultiAgentConfig,
  MultiAgentResult,
  MultiAgentMetadata,
  AgentStep,
  WorkflowContext,
  WorkflowType,
  GenerateResult,
} from 'kimi-vercel-ai-sdk-provider';

// Project Scaffolding
import {
  ProjectScaffolder,
  createEmptyScaffoldResult,
  // Types
  ScaffoldConfig,
  ScaffoldResult,
  ProjectFile,
  ProjectMetadata,
  ProjectType,
  ProjectTemplate,
  OutputFormat,
} from 'kimi-vercel-ai-sdk-provider';

// Built-in Tools
import {
  createWebSearchTool,
  createKimiWebSearchTool,
  createCodeInterpreterTool,
  KIMI_WEB_SEARCH_TOOL_NAME,
  KIMI_CODE_INTERPRETER_TOOL_NAME,
  // Types
  KimiBuiltinTool,
  KimiWebSearchConfig,
  KimiWebSearchToolOptions,
  KimiCodeInterpreterConfig,
  KimiCodeInterpreterToolOptions,
} from 'kimi-vercel-ai-sdk-provider';

// Errors
import {
  KimiError,
  KimiAuthenticationError,
  KimiRateLimitError,
  KimiValidationError,
  KimiContextLengthError,
  KimiContentFilterError,
  KimiModelNotFoundError,
  KimiEnsembleValidationError,
  KimiEnsembleTimeoutError,
  KimiMultiAgentError,
  KimiCodeValidationError,
  KimiScaffoldError,
} from 'kimi-vercel-ai-sdk-provider';
```

### Feature Comparison

| Feature | Generic OpenAI Provider | Kimi Provider |
|---------|------------------------|---------------|
| Setup | Manual baseURL & Headers | Plug-and-play |
| PDF/Doc Analysis | Not supported (only Vision) | Auto-upload & Extract |
| Thinking Models | Mixed text / Unparsed | Mapped to SDK reasoning |
| Tool Reliability | Crashes on `tool_choice: required` | Auto-fixed / Polyfilled |
| Long Context | Full price | Cached (up to 90% cheaper) |
| Web Search | Manual tool definition | `webSearch: true` toggle |
| Code Interpreter | Not available | `codeInterpreter: true` toggle |
| Type Safety | Raw strings | TypeScript enums for models |

## License

Apache-2.0

## Authors

<p><strong>Aaron Iker</strong></p>
<p valign="center">
  <a href="https://x.com/aaroniker">
    <img valign="top" src="https://img.shields.io/badge/X-@aaroniker-black?style=flat-square&logo=x" alt="X">
  </a>
  <span valign="center">&nbsp; • &nbsp;</span>
  <a href="https://github.com/aaroniker">
    <img valign="top" src="https://img.shields.io/badge/GitHub-aaroniker-black?style=flat-square&logo=github" alt="GitHub">
  </a>
  <span valign="center">&nbsp; • &nbsp;</span>
  <a href="https://www.linkedin.com/in/aaron-iker-15606897/">
    <img valign="top" src="https://img.shields.io/badge/LinkedIn-aaroniker-blue?style=flat-square&logo=linkedin" alt="LinkedIn">
  </a>
</p>

