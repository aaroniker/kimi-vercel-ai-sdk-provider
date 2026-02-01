/**
 * Multi-sampler implementation for ensemble generation.
 * @module
 */

import type {
  EnsembleConfig,
  EnsembleMetadata,
  EnsembleResponse,
  EnsembleResult,
  LanguageModelUsage,
  ScoringHeuristic,
  SelectionStrategy
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * A function that generates a single response.
 */
export type GenerateFunction = (options: { temperature: number; sampleIndex: number }) => Promise<{
  text: string;
  reasoning?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  usage?: LanguageModelUsage;
  finishReason: string;
}>;

/**
 * Options for creating a multi-sampler.
 */
export interface MultiSamplerOptions {
  /**
   * The model ID being used.
   */
  modelId: string;

  /**
   * Base temperature for generation.
   */
  baseTemperature?: number;
}

// ============================================================================
// MultiSampler Class
// ============================================================================

/**
 * Multi-sampler for generating multiple responses and selecting the best one.
 *
 * @example
 * ```ts
 * const sampler = new MultiSampler({ modelId: 'kimi-k2.5' });
 * const result = await sampler.generate(generateFn, {
 *   n: 3,
 *   selectionStrategy: 'best',
 *   scoringHeuristic: 'code',
 * });
 * ```
 */
export class MultiSampler {
  private modelId: string;
  private baseTemperature: number;

  constructor(options: MultiSamplerOptions) {
    this.modelId = options.modelId;
    this.baseTemperature = options.baseTemperature ?? 0.7;
  }

  /**
   * Generate multiple samples and select the best one.
   *
   * @param generateFn - Function to generate a single response
   * @param config - Ensemble configuration
   * @returns The ensemble result
   */
  async generate(generateFn: GenerateFunction, config: EnsembleConfig): Promise<EnsembleResult> {
    const startTime = Date.now();
    const {
      n,
      selectionStrategy = 'best',
      temperatureVariance = 0.1,
      scoringHeuristic = 'confidence',
      customScorer,
      timeoutMs = 60000,
      allowPartialFailure = true,
      minSuccessfulSamples = 1
    } = config;

    // Validate configuration
    if (n < 1 || n > 10) {
      throw new Error('Ensemble n must be between 1 and 10');
    }

    // Generate samples in parallel
    const promises = Array.from({ length: n }, async (_, i) => {
      const temperature = Math.min(this.baseTemperature + i * temperatureVariance, 2.0);
      const sampleStart = Date.now();

      try {
        const result = await generateFn({ temperature, sampleIndex: i });
        return {
          text: result.text,
          reasoning: result.reasoning,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          usage: result.usage,
          sampleIndex: i,
          temperature,
          finishReason: result.finishReason,
          success: true,
          durationMs: Date.now() - sampleStart
        } as EnsembleResponse;
      } catch (error) {
        return {
          text: '',
          sampleIndex: i,
          temperature,
          finishReason: 'error',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Date.now() - sampleStart
        } as EnsembleResponse;
      }
    });

    // Wait for all samples with timeout
    let responses: EnsembleResponse[];
    try {
      responses = await Promise.race([
        Promise.all(promises),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ensemble generation timed out')), timeoutMs)
        )
      ]);
    } catch (_error) {
      // On timeout, wait a bit more to collect partial results
      const partialResponses = await Promise.all(
        promises.map((p) =>
          p.catch(
            () =>
              ({
                text: '',
                sampleIndex: -1,
                temperature: 0,
                finishReason: 'timeout',
                success: false,
                error: 'Timed out'
              }) as EnsembleResponse
          )
        )
      );
      responses = partialResponses.filter((r) => r.sampleIndex >= 0);
    }

    // Filter successful responses
    const successfulResponses = responses.filter((r) => r.success);

    if (successfulResponses.length < minSuccessfulSamples && !allowPartialFailure) {
      throw new Error(
        `Only ${successfulResponses.length} samples succeeded, minimum required is ${minSuccessfulSamples}`
      );
    }

    if (successfulResponses.length === 0) {
      throw new Error('All ensemble samples failed');
    }

    // Apply selection strategy
    const result = this.selectBest(successfulResponses, responses, {
      selectionStrategy,
      scoringHeuristic,
      customScorer,
      modelId: this.modelId,
      startTime
    });

    return result;
  }

  /**
   * Select the best response based on the strategy.
   */
  private selectBest(
    successfulResponses: EnsembleResponse[],
    allResponses: EnsembleResponse[],
    options: {
      selectionStrategy: SelectionStrategy;
      scoringHeuristic: ScoringHeuristic;
      customScorer?: (response: EnsembleResponse) => number;
      modelId: string;
      startTime: number;
    }
  ): EnsembleResult {
    const { selectionStrategy, scoringHeuristic, customScorer, modelId, startTime } = options;

    // Score all successful responses
    const scored = successfulResponses.map((r) => {
      return {
        ...r,
        score: this.calculateScore(r, scoringHeuristic, customScorer)
      };
    });

    let winner: EnsembleResponse;
    let alternatives: EnsembleResponse[] | undefined;

    switch (selectionStrategy) {
      case 'first':
        winner = scored[0];
        break;

      case 'vote':
        winner = this.majorityVote(scored);
        break;

      case 'best':
        scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        winner = scored[0];
        break;

      case 'all':
        winner = scored[0];
        alternatives = scored;
        break;

      default:
        throw new Error(`Unknown selection strategy: ${selectionStrategy}`);
    }

    const metadata: EnsembleMetadata = {
      nRequested: allResponses.length,
      nCompleted: successfulResponses.length,
      nFailed: allResponses.filter((r) => !r.success).length,
      selectionStrategy,
      winningIndex: winner.sampleIndex,
      scores: scored.map((r) => r.score ?? 0),
      durationMs: Date.now() - startTime,
      modelId,
      totalUsage: this.aggregateUsage(successfulResponses)
    };

    return {
      text: winner.text,
      reasoning: winner.reasoning,
      toolCalls: winner.toolCalls as EnsembleResult['toolCalls'],
      toolResults: winner.toolResults as EnsembleResult['toolResults'],
      usage: winner.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      alternatives,
      metadata
    };
  }

  /**
   * Calculate score for a response based on the heuristic.
   */
  private calculateScore(
    response: EnsembleResponse,
    heuristic: ScoringHeuristic,
    customScorer?: (response: EnsembleResponse) => number
  ): number {
    switch (heuristic) {
      case 'length':
        // Prefer concise answers (inverse length, normalized)
        return 1000 / (response.text.length + 1);

      case 'confidence':
        // Higher completion tokens often indicates more complete reasoning
        return response.usage?.completionTokens ?? 0;

      case 'code':
        return this.scoreCodeQuality(response.text);

      case 'custom':
        if (!customScorer) {
          throw new Error('Custom scorer function required for custom heuristic');
        }
        return customScorer(response);

      default:
        return 0;
    }
  }

  /**
   * Score code quality based on heuristics.
   */
  private scoreCodeQuality(text: string): number {
    let score = 100;

    // Deduct for common error patterns
    const errorPatterns = [
      { pattern: /SyntaxError/gi, penalty: 25 },
      { pattern: /ReferenceError/gi, penalty: 20 },
      { pattern: /TypeError/gi, penalty: 20 },
      { pattern: /undefined is not/gi, penalty: 15 },
      { pattern: /cannot read property/gi, penalty: 15 },
      { pattern: /is not defined/gi, penalty: 15 },
      { pattern: /unexpected token/gi, penalty: 20 },
      { pattern: /null is not/gi, penalty: 15 }
    ];

    for (const { pattern, penalty } of errorPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        score -= penalty * matches.length;
      }
    }

    // Bonus for proper code blocks
    if (text.includes('```')) {
      score += 10;
    }

    // Bonus for comments/documentation
    if (/\/\/.*|\/\*[\s\S]*?\*\/|#.*/.test(text)) {
      score += 5;
    }

    // Bonus for test mentions
    if (/\b(test|spec|assert|expect|describe|it)\b/i.test(text)) {
      score += 5;
    }

    // Bonus for type annotations (TypeScript)
    if (/:\s*(string|number|boolean|void|any|unknown|never)\b/.test(text)) {
      score += 5;
    }

    // Penalty for TODO/FIXME left in code
    if (/\b(TODO|FIXME|XXX|HACK)\b/i.test(text)) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Select the most common response (majority voting).
   */
  private majorityVote(responses: EnsembleResponse[]): EnsembleResponse {
    // Simple text similarity voting based on normalized text
    const normalized = responses.map((r) => {
      return {
        response: r,
        key: r.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500)
      };
    });

    const votes = new Map<string, { count: number; response: EnsembleResponse }>();

    for (const { response, key } of normalized) {
      const existing = votes.get(key);
      if (existing) {
        existing.count++;
      } else {
        votes.set(key, { count: 1, response });
      }
    }

    // Find the response with the most votes
    let maxVotes = 0;
    let winner = responses[0];

    for (const { count, response } of votes.values()) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = response;
      }
    }

    return winner;
  }

  /**
   * Aggregate usage across all responses.
   */
  private aggregateUsage(responses: EnsembleResponse[]): LanguageModelUsage {
    return responses.reduce(
      (acc, r) => {
        return {
          promptTokens: acc.promptTokens + (r.usage?.promptTokens ?? 0),
          completionTokens: acc.completionTokens + (r.usage?.completionTokens ?? 0),
          totalTokens: acc.totalTokens + (r.usage?.totalTokens ?? 0)
        };
      },
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple ensemble result from a single response.
 * Useful for when ensemble is disabled but consistent return types are needed.
 */
export function createSingletonEnsembleResult(
  response: {
    text: string;
    reasoning?: string;
    toolCalls?: unknown[];
    toolResults?: unknown[];
    usage?: LanguageModelUsage;
    finishReason: string;
  },
  modelId: string,
  durationMs: number
): EnsembleResult {
  return {
    text: response.text,
    reasoning: response.reasoning,
    toolCalls: response.toolCalls as EnsembleResult['toolCalls'],
    toolResults: response.toolResults as EnsembleResult['toolResults'],
    usage: response.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metadata: {
      nRequested: 1,
      nCompleted: 1,
      nFailed: 0,
      selectionStrategy: 'first',
      winningIndex: 0,
      scores: [100],
      durationMs,
      modelId,
      totalUsage: response.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    }
  };
}
