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
} from 'kimi-vercel-ai-sdk-provider
';

// Kimi Code Provider
import {
  createKimiCode,
  kimiCode,
  KimiCodeLanguageModel,
  inferKimiCodeCapabilities,
  kimiCodeProviderOptionsSchema,
  toAnthropicThinking,
  // Constants
  KIMI_CODE_BASE_URL,
  KIMI_CODE_OPENAI_BASE_URL,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_THINKING_MODEL,
  KIMI_CODE_MODELS,
  KIMI_CODE_DEFAULT_MAX_TOKENS,
  KIMI_CODE_DEFAULT_CONTEXT_WINDOW,
  KIMI_CODE_ANTHROPIC_VERSION,
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
  FileCache,
  generateContentHash,
  generateCacheKey,
  getDefaultFileCache,
  setDefaultFileCache,
  clearDefaultFileCache,
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
  FileCacheOptions,
  FileCacheEntry,
} from 'kimi-vercel-ai-sdk-provider';

// Utilities
import {
  analyzeReasoningPreservation,
  recommendThinkingModel,
  // Constants
  THINKING_MODEL_TEMPERATURE,
  THINKING_MODEL_DEFAULT_MAX_TOKENS,
  STANDARD_MODEL_DEFAULT_MAX_TOKENS,
  // Types
  ReasoningAnalysis,
} from 'kimi-vercel-ai-sdk-provider';

// Built-in Tools
import {
  createWebSearchTool,
  createKimiWebSearchTool,
  createCodeInterpreterTool,
  KIMI_WEB_SEARCH_TOOL_NAME,
  KIMI_CODE_INTERPRETER_TOOL_NAME,
} from 'kimi-vercel-ai-sdk-provider
';

// Errors
import {
  KimiError,
  KimiAuthenticationError,
  KimiRateLimitError,
  KimiValidationError,
  KimiContextLengthError,
  KimiContentFilterError,
  KimiModelNotFoundError,
} from 'kimi-vercel-ai-sdk-provider
';
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

