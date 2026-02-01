# ai-sdk-provider-kimi

Native Kimi (Moonshot AI) provider for Vercel AI SDK v6.

This is a **native implementation** with full support for Kimi-specific features, not a generic OpenAI-compatible wrapper.

## Features

- ✅ **Built-in Web Search** - Enable `$web_search` for grounded responses with source citations
- ✅ **Deep Thinking/Reasoning** - Full support for reasoning models (`kimi-k2.5-thinking`, `kimi-k2-thinking`)
- ✅ **Video Input** - K2.5 models support video URLs in prompts
- ✅ **256k Context Window** - Full support for Kimi's large context
- ✅ **Token Tracking** - Detailed usage including cache hits and reasoning tokens
- ✅ **Regional Endpoints** - Global and China (cn) endpoint support

## Install

```bash
npm install ai-sdk-provider-kimi
```

## Quick Start

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

## Built-in Web Search

Kimi has a unique built-in web search capability that runs server-side. Enable it to get grounded responses with real-time information:

```ts
// Enable via model settings
const kimi = createKimi();
const model = kimi('kimi-k2.5', { webSearch: true });

const result = await generateText({
  model,
  prompt: 'What are the latest AI news today?',
});

// Or enable per-request via provider options
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
          search_result: true, // Include search results in response
        },
      },
    },
  },
});
```

### Web Search Token Tracking

When web search is used, token usage is tracked separately:

```ts
const result = await generateText({
  model: kimi('kimi-k2.5', { webSearch: true }),
  prompt: 'Current weather in Tokyo',
});

// Access web search tokens from usage
console.log(result.usage);
// {
//   inputTokens: { total: 150, cacheRead: 50, ... },
//   outputTokens: { total: 200, reasoning: 0, ... },
//   webSearchTokens: 1500, // Tokens used by web search
// }
```

## Reasoning/Thinking Models

Kimi's thinking models provide step-by-step reasoning:

```ts
const stream = await streamText({
  model: kimi('kimi-k2.5-thinking'),
  prompt: 'Prove that √2 is irrational.',
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
import { inferModelCapabilities } from 'ai-sdk-provider-kimi';

const caps = inferModelCapabilities('kimi-k2.5-thinking');
// {
//   thinking: true,
//   alwaysThinking: true,
//   imageInput: true,
//   videoInput: true,
//   maxContextSize: 256000,
// }
```

## Provider Options

Pass Kimi-specific options via `providerOptions.kimi`:

```ts
const result = await generateText({
  model: kimi('kimi-k2.5'),
  prompt: 'Return JSON with `name` and `version`.',
  responseFormat: { type: 'json' },
  providerOptions: {
    kimi: {
      user: 'user-123',           // End-user identifier
      requestId: 'trace-abc',     // Adds X-Request-ID header
      strictJsonSchema: true,     // Strict JSON schema validation
      extraHeaders: { ... },      // Additional headers
      parallelToolCalls: true,    // Allow parallel tool execution
      webSearch: true,            // Enable web search
    },
  },
});
```

## Available Models

| Model | Features |
|-------|----------|
| `kimi-k2.5` | Latest, image/video input, web search |
| `kimi-k2.5-thinking` | K2.5 + always-on deep reasoning |
| `kimi-k2-turbo` | Fast, cost-effective |
| `kimi-k2-thinking` | K2 + always-on deep reasoning |

## Regional Endpoints

```ts
// Global (default) - api.moonshot.ai
const kimiGlobal = createKimi({ endpoint: 'global' });

// China - api.moonshot.cn (lower latency in mainland China)
const kimiChina = createKimi({ endpoint: 'cn' });

// Custom endpoint
const kimiCustom = createKimi({ 
  baseURL: 'https://your-proxy.example.com/v1' 
});
```

## Environment Variables

- `MOONSHOT_API_KEY` - Your Moonshot AI API key (required)
- `MOONSHOT_BASE_URL` - Override the base URL (optional)

## Why Native vs OpenAI-Compatible?

This provider is built natively for Kimi rather than using `@ai-sdk/openai-compatible`. Benefits:

| Feature | Native Provider | OpenAI-Compatible |
|---------|-----------------|-------------------|
| `$web_search` built-in tool | ✅ Full support | ❌ Not available |
| Web search token tracking | ✅ Included | ❌ Not available |
| Video input support | ✅ Automatic | ⚠️ Manual config |
| Reasoning content streaming | ✅ Native handling | ⚠️ May need config |
| Model capability inference | ✅ Automatic | ❌ Manual |
| Type-safe provider options | ✅ Full types | ⚠️ Partial |
| Error messages | ✅ Kimi-specific | ⚠️ Generic |

## License

MIT
