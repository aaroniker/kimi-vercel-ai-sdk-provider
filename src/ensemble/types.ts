/**
 * Types for ensemble/multi-sampling functionality.
 * @module
 */

import type { LanguageModelV3ToolCall, LanguageModelV3ToolResult } from '@ai-sdk/provider';

/**
 * Simple usage type compatible with common AI SDK patterns.
 * This is independent from the provider-specific V3Usage type.
 */
export interface LanguageModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Re-export types for convenience.
 */
export type ToolCall = LanguageModelV3ToolCall;
export type ToolResult = LanguageModelV3ToolResult;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Selection strategy for choosing the best response from multiple samples.
 */
export type SelectionStrategy = 'first' | 'vote' | 'best' | 'all';

/**
 * Scoring heuristic for the 'best' selection strategy.
 */
export type ScoringHeuristic = 'length' | 'confidence' | 'code' | 'custom';

/**
 * Configuration for ensemble/multi-sampling.
 */
export interface EnsembleConfig {
  /**
   * Number of parallel samples to generate.
   * @default 3
   */
  n: number;

  /**
   * Strategy for selecting the best result.
   * - 'first': Return the first successful response
   * - 'vote': Return the most common answer (majority voting)
   * - 'best': Use heuristic scoring to pick the best
   * - 'all': Return all responses (for manual selection)
   * @default 'best'
   */
  selectionStrategy?: SelectionStrategy;

  /**
   * Temperature variation for diversity.
   * Each sample gets temperature = baseTemp + (i * variance)
   * @default 0.1
   */
  temperatureVariance?: number;

  /**
   * For 'best' strategy, the scoring heuristic.
   * - 'length': Prefer shorter responses
   * - 'confidence': Prefer responses with higher token count
   * - 'code': Prefer responses with fewer error patterns
   * - 'custom': Use custom scorer function
   * @default 'confidence'
   */
  scoringHeuristic?: ScoringHeuristic;

  /**
   * Custom scoring function for 'custom' heuristic.
   * Higher scores are better.
   */
  customScorer?: (response: EnsembleResponse) => number;

  /**
   * Maximum time to wait for all samples (ms).
   * @default 60000
   */
  timeoutMs?: number;

  /**
   * Whether to continue if some samples fail.
   * @default true
   */
  allowPartialFailure?: boolean;

  /**
   * Minimum number of successful samples required.
   * Only relevant when allowPartialFailure is true.
   * @default 1
   */
  minSuccessfulSamples?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * A single response from the ensemble.
 */
export interface EnsembleResponse {
  /**
   * The generated text.
   */
  text: string;

  /**
   * Reasoning content (for thinking models).
   */
  reasoning?: string;

  /**
   * Tool calls made during generation.
   */
  toolCalls?: ToolCall[];

  /**
   * Results of tool executions.
   */
  toolResults?: ToolResult[];

  /**
   * Token usage for this response.
   */
  usage?: LanguageModelUsage;

  /**
   * Score assigned to this response (if scoring was applied).
   */
  score?: number;

  /**
   * Index of this sample in the ensemble.
   */
  sampleIndex: number;

  /**
   * Temperature used for this sample.
   */
  temperature: number;

  /**
   * Reason the generation finished.
   */
  finishReason: string;

  /**
   * Whether this sample completed successfully.
   */
  success: boolean;

  /**
   * Error message if the sample failed.
   */
  error?: string;

  /**
   * Time taken to generate this response (ms).
   */
  durationMs?: number;
}

/**
 * Metadata about the ensemble execution.
 */
export interface EnsembleMetadata {
  /**
   * Number of samples requested.
   */
  nRequested: number;

  /**
   * Number of samples that completed successfully.
   */
  nCompleted: number;

  /**
   * Number of samples that failed.
   */
  nFailed: number;

  /**
   * Selection strategy used.
   */
  selectionStrategy: SelectionStrategy;

  /**
   * Index of the winning sample.
   */
  winningIndex: number;

  /**
   * Scores of all samples (if scoring was applied).
   */
  scores?: number[];

  /**
   * Total time for ensemble execution (ms).
   */
  durationMs: number;

  /**
   * Model ID used.
   */
  modelId: string;

  /**
   * Aggregated token usage across all samples.
   */
  totalUsage: LanguageModelUsage;
}

/**
 * Result of an ensemble generation.
 */
export interface EnsembleResult {
  /**
   * The selected best response text.
   */
  text: string;

  /**
   * Reasoning content from the best response.
   */
  reasoning?: string;

  /**
   * Tool calls from the best response.
   */
  toolCalls?: ToolCall[];

  /**
   * Tool results from the best response.
   */
  toolResults?: ToolResult[];

  /**
   * Token usage from the best response.
   */
  usage: LanguageModelUsage;

  /**
   * All generated responses (populated for 'all' strategy).
   */
  alternatives?: EnsembleResponse[];

  /**
   * Metadata about the ensemble execution.
   */
  metadata: EnsembleMetadata;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Internal state for tracking ensemble progress.
 */
export interface EnsembleState {
  responses: EnsembleResponse[];
  startTime: number;
  completed: boolean;
}

/**
 * Options for scoring a response.
 */
export interface ScoringOptions {
  heuristic: ScoringHeuristic;
  customScorer?: (response: EnsembleResponse) => number;
}
