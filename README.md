# ai-sdk-provider-kimi

Native Kimi (Moonshot AI) provider for Vercel AI SDK v6.

This is a native implementation with full support for Kimi-specific features, not a generic OpenAI-compatible wrapper.

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

### Kimi Code (Premium Coding API)
- High-speed output (up to 100 tokens/s)
- Extended thinking/reasoning support with configurable effort levels
- 262k context window
- Streaming with thinking blocks

## Install

```bash
npm install ai-sdk-provider-kimi
```

## Quick Start

### Kimi Chat (Standard)

```ts
import { createKimi } from 'ai-sdk-provider-kimi';
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
import { kimiCode, createKimiCode } from 'ai-sdk-provider-kimi';
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
import { kimi, kimiTools } from 'ai-sdk-provider-kimi';

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
import { inferModelCapabilities, inferKimiCodeCapabilities } from 'ai-sdk-provider-kimi';

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
  kimiTools,
  // Types
  KimiProvider,
  KimiProviderSettings,
  KimiChatSettings,
  KimiChatModelId,
  KimiProviderOptions,
  KimiModelCapabilities,
} from 'ai-sdk-provider-kimi';

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
} from 'ai-sdk-provider-kimi';

// Built-in Tools
import {
  createWebSearchTool,
  createKimiWebSearchTool,
  createCodeInterpreterTool,
  KIMI_WEB_SEARCH_TOOL_NAME,
  KIMI_CODE_INTERPRETER_TOOL_NAME,
} from 'ai-sdk-provider-kimi';

// Errors
import {
  KimiError,
  KimiAuthenticationError,
  KimiRateLimitError,
  KimiValidationError,
  KimiContextLengthError,
  KimiContentFilterError,
  KimiModelNotFoundError,
} from 'ai-sdk-provider-kimi';
```

## License

Apache-2.0
