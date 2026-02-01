/**
 * Tests for multi-turn reasoning utilities.
 */

import { describe, expect, it } from 'vitest';
import { analyzeReasoningPreservation, recommendThinkingModel } from '../core';

describe('analyzeReasoningPreservation', () => {
  it('should detect messages with reasoning content', () => {
    const messages = [
      { role: 'user', content: 'What is 2+2?' },
      {
        role: 'assistant',
        content: 'The answer is 4.',
        reasoning_content: 'Let me calculate: 2+2 = 4'
      }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.messagesWithReasoning).toBe(1);
    expect(analysis.isPreserved).toBe(true);
    expect(analysis.missingReasoningIndices).toHaveLength(0);
  });

  it('should handle reasoning field variant', () => {
    const messages = [
      { role: 'user', content: 'Test' },
      {
        role: 'assistant',
        content: 'Answer',
        reasoning: 'My reasoning process...'
      }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.messagesWithReasoning).toBe(1);
  });

  it('should estimate reasoning tokens', () => {
    const messages = [
      { role: 'user', content: 'Test' },
      {
        role: 'assistant',
        content: 'Answer',
        reasoning_content: 'A'.repeat(400) // 400 chars ≈ 100 tokens
      }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.estimatedReasoningTokens).toBe(100);
  });

  it('should detect missing reasoning after tool calls', () => {
    const messages = [
      { role: 'user', content: 'Search for X' },
      {
        role: 'assistant',
        content: null,
        reasoning_content: 'I need to search...',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }]
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'Search results...' },
      {
        role: 'assistant',
        content: 'Here are the results', // Missing reasoning!
        reasoning_content: null
      }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.isPreserved).toBe(false);
    expect(analysis.missingReasoningIndices).toContain(3);
  });

  it('should handle proper reasoning preservation in tool loops', () => {
    const messages = [
      { role: 'user', content: 'Search for X' },
      {
        role: 'assistant',
        content: null,
        reasoning_content: 'I need to search...',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } }]
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'Search results...' },
      {
        role: 'assistant',
        content: 'Here are the results',
        reasoning_content: 'Based on the search results, I can now answer...'
      }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.isPreserved).toBe(true);
    expect(analysis.messagesWithReasoning).toBe(2);
  });

  it('should handle empty conversations', () => {
    const analysis = analyzeReasoningPreservation([]);

    expect(analysis.messagesWithReasoning).toBe(0);
    expect(analysis.isPreserved).toBe(true);
    expect(analysis.estimatedReasoningTokens).toBe(0);
  });

  it('should handle conversations without assistant messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'system', content: 'You are helpful' }
    ];

    const analysis = analyzeReasoningPreservation(messages);

    expect(analysis.messagesWithReasoning).toBe(0);
    expect(analysis.isPreserved).toBe(true);
  });
});

describe('recommendThinkingModel', () => {
  it('should recommend for high complexity tasks', () => {
    const recommendation = recommendThinkingModel(1, false, 0.8);

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('High complexity');
  });

  it('should recommend for multi-turn tool usage', () => {
    const recommendation = recommendThinkingModel(5, true, 0.3);

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('tool usage');
  });

  it('should recommend for moderate complexity', () => {
    const recommendation = recommendThinkingModel(1, false, 0.6);

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('Moderate complexity');
  });

  it('should not recommend for simple tasks', () => {
    const recommendation = recommendThinkingModel(1, false, 0.2);

    expect(recommendation.recommended).toBe(false);
    expect(recommendation.reason).toContain('Standard model sufficient');
  });

  it('should not recommend for short tool conversations', () => {
    const recommendation = recommendThinkingModel(2, true, 0.3);

    expect(recommendation.recommended).toBe(false);
  });

  it('should prioritize high complexity over other factors', () => {
    const recommendation = recommendThinkingModel(1, false, 0.9);

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('High complexity');
  });
});
