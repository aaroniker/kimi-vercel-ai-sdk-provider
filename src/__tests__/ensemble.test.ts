import type { EnsembleResponse } from '../ensemble/types';
import { describe, expect, it, vi } from 'vitest';
import { MultiSampler, createSingletonEnsembleResult } from '../ensemble/multi-sampler';

describe('Ensemble / Multi-Sampling', () => {
  describe('MultiSampler', () => {
    const createMockGenerator = (responses: Array<{ text: string; error?: string }>) => {
      let callIndex = 0;
      return vi.fn().mockImplementation(async ({ temperature, sampleIndex }) => {
        const response = responses[callIndex % responses.length];
        callIndex++;

        if (response.error) {
          throw new Error(response.error);
        }

        return {
          text: response.text,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          finishReason: 'stop',
          temperature,
          sampleIndex
        };
      });
    };

    it('generates multiple samples', async () => {
      const sampler = new MultiSampler({ modelId: 'test-model' });
      const generator = createMockGenerator([{ text: 'Response 1' }, { text: 'Response 2' }, { text: 'Response 3' }]);

      const result = await sampler.generate(generator, {
        n: 3,
        selectionStrategy: 'first'
      });

      expect(generator).toHaveBeenCalledTimes(3);
      expect(result.text).toBe('Response 1');
      expect(result.metadata.nRequested).toBe(3);
      expect(result.metadata.nCompleted).toBe(3);
    });

    it('applies temperature variance', async () => {
      const sampler = new MultiSampler({ modelId: 'test-model', baseTemperature: 0.5 });
      const temperatures: number[] = [];

      const generator = vi.fn().mockImplementation(async ({ temperature }) => {
        temperatures.push(temperature);
        return {
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          finishReason: 'stop'
        };
      });

      await sampler.generate(generator, {
        n: 3,
        temperatureVariance: 0.2,
        selectionStrategy: 'first'
      });

      expect(temperatures[0]).toBe(0.5);
      expect(temperatures[1]).toBe(0.7);
      expect(temperatures[2]).toBe(0.9);
    });

    describe('selection strategies', () => {
      it('first strategy returns first response', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        const generator = createMockGenerator([{ text: 'First' }, { text: 'Second' }, { text: 'Third' }]);

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'first'
        });

        expect(result.text).toBe('First');
        expect(result.metadata.winningIndex).toBe(0);
      });

      it('best strategy with confidence heuristic prefers longer completions', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        let callIndex = 0;

        const generator = vi.fn().mockImplementation(async () => {
          callIndex++;
          const completionTokens = callIndex === 2 ? 100 : 20; // Second response has most tokens
          return {
            text: `Response ${callIndex}`,
            usage: { promptTokens: 10, completionTokens, totalTokens: 10 + completionTokens },
            finishReason: 'stop'
          };
        });

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'best',
          scoringHeuristic: 'confidence'
        });

        expect(result.metadata.winningIndex).toBe(1); // Second response wins
      });

      it('best strategy with code heuristic penalizes errors', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });

        const generator = vi.fn().mockImplementation(async ({ sampleIndex }) => {
          const texts = [
            'function test() { return SyntaxError; }', // Has error pattern
            'function test() { return 42; }', // Clean code
            'TypeError: undefined is not a function' // Has error
          ];
          return {
            text: texts[sampleIndex],
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            finishReason: 'stop'
          };
        });

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'best',
          scoringHeuristic: 'code'
        });

        expect(result.metadata.winningIndex).toBe(1); // Clean code wins
      });

      it('all strategy returns alternatives', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        const generator = createMockGenerator([{ text: 'First' }, { text: 'Second' }, { text: 'Third' }]);

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'all'
        });

        expect(result.alternatives).toHaveLength(3);
        expect(result.alternatives![0].text).toBe('First');
        expect(result.alternatives![1].text).toBe('Second');
        expect(result.alternatives![2].text).toBe('Third');
      });
    });

    describe('error handling', () => {
      it('handles partial failures with allowPartialFailure', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        const generator = createMockGenerator([
          { text: 'Success' },
          { text: '', error: 'Failed' },
          { text: 'Another success' }
        ]);

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'first',
          allowPartialFailure: true
        });

        expect(result.metadata.nCompleted).toBe(2);
        expect(result.metadata.nFailed).toBe(1);
      });

      it('throws when all samples fail', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        const generator = createMockGenerator([
          { text: '', error: 'Failed 1' },
          { text: '', error: 'Failed 2' },
          { text: '', error: 'Failed 3' }
        ]);

        await expect(
          sampler.generate(generator, {
            n: 3,
            selectionStrategy: 'first'
          })
        ).rejects.toThrow('All ensemble samples failed');
      });

      it('validates n parameter', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });
        const generator = createMockGenerator([{ text: 'test' }]);

        await expect(sampler.generate(generator, { n: 0, selectionStrategy: 'first' })).rejects.toThrow(
          'Ensemble n must be between 1 and 10'
        );

        await expect(sampler.generate(generator, { n: 11, selectionStrategy: 'first' })).rejects.toThrow(
          'Ensemble n must be between 1 and 10'
        );
      });
    });

    describe('custom scorer', () => {
      it('uses custom scorer when heuristic is custom', async () => {
        const sampler = new MultiSampler({ modelId: 'test-model' });

        const generator = vi.fn().mockImplementation(async ({ sampleIndex }) => {
          return {
            text: `Response ${sampleIndex}`,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            finishReason: 'stop'
          };
        });

        const customScorer = vi.fn().mockImplementation((response: EnsembleResponse) => {
          // Prefer response 2
          return response.sampleIndex === 2 ? 100 : 10;
        });

        const result = await sampler.generate(generator, {
          n: 3,
          selectionStrategy: 'best',
          scoringHeuristic: 'custom',
          customScorer
        });

        expect(customScorer).toHaveBeenCalledTimes(3);
        expect(result.metadata.winningIndex).toBe(2);
      });
    });
  });

  describe('createSingletonEnsembleResult', () => {
    it('creates a result for single response', () => {
      const response = {
        text: 'Hello',
        reasoning: 'Thinking...',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop'
      };

      const result = createSingletonEnsembleResult(response, 'test-model', 100);

      expect(result.text).toBe('Hello');
      expect(result.reasoning).toBe('Thinking...');
      expect(result.metadata.nRequested).toBe(1);
      expect(result.metadata.nCompleted).toBe(1);
      expect(result.metadata.modelId).toBe('test-model');
      expect(result.metadata.durationMs).toBe(100);
    });
  });
});
