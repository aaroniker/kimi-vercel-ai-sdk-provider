import { describe, it, expect } from 'vitest';
import { convertToKimiChatMessages } from './kimi-convert-messages';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

describe('convertToKimiChatMessages', () => {
  describe('system messages', () => {
    it('should convert system message', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
      ]);
    });
  });

  describe('user messages', () => {
    it('should convert simple text message to string', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should convert multiple text parts to array', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ]);
    });

    it('should convert image URL file part', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: new URL('https://example.com/image.jpg'),
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image.jpg' },
            },
          ],
        },
      ]);
    });

    it('should convert image/* to image/jpeg', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/*',
              data: new URL('https://example.com/image.jpg'),
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result[0]).toMatchObject({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'https://example.com/image.jpg' },
          },
        ],
      });
    });

    it('should convert video URL file part', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is happening?' },
            {
              type: 'file',
              mediaType: 'video/mp4',
              data: new URL('https://example.com/video.mp4'),
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is happening?' },
            {
              type: 'video_url',
              video_url: { url: 'https://example.com/video.mp4' },
            },
          ],
        },
      ]);
    });

    it('should throw for inline video data', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'video/mp4',
              data: new Uint8Array([1, 2, 3]),
            },
          ],
        },
      ];

      expect(() => convertToKimiChatMessages(prompt)).toThrow(
        'inline video data',
      );
    });

    it('should convert text file to text part', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'text/plain',
              data: 'File content here',
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'File content here' }],
        },
      ]);
    });
  });

  describe('assistant messages', () => {
    it('should convert text content', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        { role: 'assistant', content: 'Hello!' },
      ]);
    });

    it('should convert reasoning content', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Let me think...' },
            { type: 'text', text: 'The answer is 42.' },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'The answer is 42.',
          reasoning_content: 'Let me think...',
        },
      ]);
    });

    it('should convert tool calls', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-123',
              toolName: 'get_weather',
              input: { location: 'Tokyo' },
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"Tokyo"}',
              },
            },
          ],
        },
      ]);
    });

    it('should handle mixed content', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking...' },
            { type: 'text', text: 'I will check the weather.' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              input: { location: 'NYC' },
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'I will check the weather.',
          reasoning_content: 'Thinking...',
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"NYC"}',
              },
            },
          ],
        },
      ]);
    });
  });

  describe('tool messages', () => {
    it('should convert text tool result', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-123',
              toolName: 'get_weather',
              output: { type: 'text', value: 'Sunny, 25°C' },
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'tool',
          tool_call_id: 'call-123',
          content: 'Sunny, 25°C',
        },
      ]);
    });

    it('should convert json tool result', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-123',
              toolName: 'get_weather',
              output: {
                type: 'json',
                value: { temp: 25, condition: 'sunny' },
              },
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'tool',
          tool_call_id: 'call-123',
          content: '{"temp":25,"condition":"sunny"}',
        },
      ]);
    });

    it('should handle execution-denied', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-123',
              toolName: 'dangerous_tool',
              output: {
                type: 'execution-denied',
                reason: 'Access denied',
              },
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        {
          role: 'tool',
          tool_call_id: 'call-123',
          content: 'Access denied',
        },
      ]);
    });

    it('should skip tool-approval-response', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-123',
              approved: true,
            },
          ],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([]);
    });
  });

  describe('full conversation', () => {
    it('should convert a complete conversation', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help?' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'What is the weather?' }],
        },
      ];

      const result = convertToKimiChatMessages(prompt);

      expect(result).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello! How can I help?' },
        { role: 'user', content: 'What is the weather?' },
      ]);
    });
  });
});
