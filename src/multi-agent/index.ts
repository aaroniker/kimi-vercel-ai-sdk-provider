/**
 * Multi-agent collaboration module exports.
 * @module
 */

export type {
  AgentStep,
  GenerateResult,
  MultiAgentConfig,
  MultiAgentMetadata,
  MultiAgentResult,
  WorkflowContext,
  WorkflowType
} from './types';
export type {
  GenerateTextFunction,
  ValidateCodeFunction,
  WorkflowRunnerOptions
} from './workflows';
export { DEFAULT_SYSTEM_PROMPTS } from './types';
export { WorkflowRunner, createEmptyMultiAgentResult } from './workflows';
