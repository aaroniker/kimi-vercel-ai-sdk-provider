/**
 * Basic usage examples for the Kimi provider.
 *
 * To run these examples:
 * 1. Set your MOONSHOT_API_KEY environment variable
 * 2. Install dependencies: npm install ai kimi-vercel-ai-sdk-provider

 * 3. Run with: npx tsx examples/basic.ts
 */

import { generateText, streamText } from 'ai';
import { createKimi, inferModelCapabilities } from '../src';

// Create a Kimi provider instance
const kimi = createKimi({
  // Uses MOONSHOT_API_KEY env var by default
  // endpoint: 'global', // or 'cn' for China endpoint
});

// =============================================================================
// Example 1: Basic text generation
// =============================================================================

async function basicGeneration() {
  console.log('\n--- Basic Text Generation ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5'),
    prompt: 'Explain quantum computing in one sentence.'
  });

  console.log('Response:', result.text);
  console.log('Usage:', result.usage);
}

// =============================================================================
// Example 2: Streaming with reasoning model
// =============================================================================

async function streamingWithReasoning() {
  console.log('\n--- Streaming with Reasoning Model ---\n');

  const stream = await streamText({
    model: kimi('kimi-k2.5-thinking', { includeUsageInStream: true }),
    prompt: 'Solve step by step: If a train travels 120km in 2 hours, what is its speed in m/s?'
  });

  for await (const part of stream.fullStream) {
    switch (part.type) {
      case 'reasoning-start':
        console.log('\n🤔 Thinking...');
        break;
      case 'reasoning-delta':
        process.stdout.write(part.delta);
        break;
      case 'reasoning-end':
        console.log('\n\n📝 Answer:');
        break;
      case 'text-delta':
        process.stdout.write(part.delta);
        break;
      case 'finish':
        console.log('\n\nUsage:', part.usage);
        break;
    }
  }
}

// =============================================================================
// Example 3: Web search enabled
// =============================================================================

async function webSearchExample() {
  console.log('\n--- Web Search Example ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5', { webSearch: true }),
    prompt: 'What are the latest developments in AI as of today?'
  });

  console.log('Response:', result.text);

  // Check if web search was used
  if (result.usage && 'webSearchTokens' in result.usage) {
    console.log('Web search tokens used:', result.usage.webSearchTokens);
  }
}

// =============================================================================
// Example 4: Web search via provider options
// =============================================================================

async function webSearchViaProviderOptions() {
  console.log('\n--- Web Search via Provider Options ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5'),
    prompt: 'What is the current price of Bitcoin?',
    providerOptions: {
      kimi: {
        webSearch: {
          enabled: true,
          config: {
            search_result: true
          }
        },
        requestId: 'example-request-123'
      }
    }
  });

  console.log('Response:', result.text);
}

// =============================================================================
// Example 5: Tool use
// =============================================================================

async function toolUseExample() {
  console.log('\n--- Tool Use Example ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5'),
    prompt: 'What is the weather in Tokyo and New York?',
    tools: {
      getWeather: {
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city name'
            }
          },
          required: ['location']
        },
        execute: async ({ location }) => {
          // Simulated weather data
          const weather: Record<string, string> = {
            Tokyo: 'Sunny, 22°C',
            'New York': 'Cloudy, 15°C'
          };
          return weather[location] || 'Unknown location';
        }
      }
    },
    maxSteps: 3
  });

  console.log('Response:', result.text);
}

// =============================================================================
// Example 6: Model capabilities
// =============================================================================

function modelCapabilitiesExample() {
  console.log('\n--- Model Capabilities ---\n');

  const models = ['kimi-k2.5', 'kimi-k2.5-thinking', 'kimi-k2-turbo', 'kimi-k2-thinking'];

  for (const modelId of models) {
    const caps = inferModelCapabilities(modelId);
    console.log(`${modelId}:`);
    console.log(`  - Thinking: ${caps.thinking ? '✅' : '❌'}`);
    console.log(`  - Always Thinking: ${caps.alwaysThinking ? '✅' : '❌'}`);
    console.log(`  - Image Input: ${caps.imageInput ? '✅' : '❌'}`);
    console.log(`  - Video Input: ${caps.videoInput ? '✅' : '❌'}`);
    console.log(`  - Max Context: ${caps.maxContextSize?.toLocaleString()} tokens`);
    console.log();
  }
}

// =============================================================================
// Example 7: Image input
// =============================================================================

async function imageInputExample() {
  console.log('\n--- Image Input Example ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail.' },
          {
            type: 'image',
            image: new URL(
              'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png'
            )
          }
        ]
      }
    ]
  });

  console.log('Response:', result.text);
}

// =============================================================================
// Example 8: JSON output
// =============================================================================

async function jsonOutputExample() {
  console.log('\n--- JSON Output Example ---\n');

  const result = await generateText({
    model: kimi('kimi-k2.5'),
    prompt: 'Return a JSON object with name, version, and features array for a fictional software product.',
    responseFormat: { type: 'json' },
    providerOptions: {
      kimi: {
        strictJsonSchema: true
      }
    }
  });

  console.log('Response:', result.text);
  try {
    const parsed = JSON.parse(result.text);
    console.log('Parsed:', parsed);
  } catch {
    console.log('Failed to parse JSON');
  }
}

// =============================================================================
// Run examples
// =============================================================================

async function main() {
  // Show model capabilities (doesn't require API key)
  modelCapabilitiesExample();

  // The following require MOONSHOT_API_KEY to be set
  if (!process.env.MOONSHOT_API_KEY) {
    console.log('\n⚠️  Set MOONSHOT_API_KEY to run API examples\n');
    return;
  }

  try {
    await basicGeneration();
    await streamingWithReasoning();
    await webSearchExample();
    await webSearchViaProviderOptions();
    await toolUseExample();
    await imageInputExample();
    await jsonOutputExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
