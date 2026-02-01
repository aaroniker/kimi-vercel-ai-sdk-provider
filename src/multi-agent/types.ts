/**
 * Types for multi-agent collaboration functionality.
 * @module
 */

/**
 * Simple usage type compatible with common AI SDK patterns.
 * This is independent from the provider-specific V3Usage type.
 */
export interface LanguageModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Available multi-agent workflow types.
 */
export type WorkflowType = 'planner-executor' | 'proposer-critic' | 'debate' | 'custom';

/**
 * Configuration for multi-agent collaboration.
 */
export interface MultiAgentConfig {
  /**
   * Multi-agent workflow type.
   * - 'planner-executor': One agent plans, another executes
   * - 'proposer-critic': One proposes, another critiques and refines
   * - 'debate': Multiple agents debate and converge on answer
   * - 'custom': Use custom workflow
   * @default 'planner-executor'
   */
  workflow: WorkflowType;

  /**
   * Model for the first agent (typically thinking/planning).
   * @default 'kimi-k2.5-thinking'
   */
  modelA?: string;

  /**
   * Model for the second agent (typically coding/action).
   * @default 'kimi-k2.5'
   */
  modelB?: string;

  /**
   * Number of refinement iterations for proposer-critic.
   * @default 2
   */
  iterations?: number;

  /**
   * Include code validation in the workflow.
   * @default false
   */
  validateCode?: boolean;

  /**
   * Maximum time for the entire workflow (ms).
   * @default 120000
   */
  timeoutMs?: number;

  /**
   * Custom workflow function.
   */
  customWorkflow?: (prompt: string, context: WorkflowContext) => Promise<MultiAgentResult>;

  /**
   * Enable verbose logging of intermediate steps.
   * @default false
   */
  verbose?: boolean;

  /**
   * System prompts for agents.
   */
  systemPrompts?: {
    planner?: string;
    executor?: string;
    proposer?: string;
    critic?: string;
  };
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * A single step in the multi-agent workflow.
 */
export interface AgentStep {
  /**
   * Agent identifier (A, B, or custom name).
   */
  agent: string;

  /**
   * Role of the agent in this step.
   */
  role: 'planner' | 'executor' | 'proposer' | 'critic' | 'validator' | 'custom';

  /**
   * Action performed.
   */
  action: string;

  /**
   * Input provided to the agent.
   */
  input?: string;

  /**
   * Output from the agent.
   */
  output: string;

  /**
   * Timestamp when this step completed.
   */
  timestamp: number;

  /**
   * Duration of this step (ms).
   */
  durationMs: number;

  /**
   * Token usage for this step.
   */
  usage?: LanguageModelUsage;

  /**
   * Model used for this step.
   */
  model?: string;
}

/**
 * Metadata about the multi-agent execution.
 */
export interface MultiAgentMetadata {
  /**
   * Workflow type used.
   */
  workflow: WorkflowType;

  /**
   * Total number of iterations/steps.
   */
  iterations: number;

  /**
   * Total duration (ms).
   */
  durationMs: number;

  /**
   * Models used in the workflow.
   */
  models: string[];

  /**
   * Whether code validation was enabled.
   */
  validationEnabled: boolean;

  /**
   * Whether the workflow completed successfully.
   */
  success: boolean;

  /**
   * Error message if workflow failed.
   */
  error?: string;
}

/**
 * Result of a multi-agent collaboration.
 */
export interface MultiAgentResult {
  /**
   * The final generated text.
   */
  text: string;

  /**
   * Reasoning/plan from the planning phase.
   */
  reasoning?: string;

  /**
   * All intermediate steps in the workflow.
   */
  intermediateSteps: AgentStep[];

  /**
   * Aggregated token usage.
   */
  usage: LanguageModelUsage;

  /**
   * Metadata about the execution.
   */
  metadata: MultiAgentMetadata;

  /**
   * Code validation result (if enabled).
   */
  validation?: {
    valid: boolean;
    errors: string[];
    finalCode?: string;
  };
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context passed to workflow functions.
 */
export interface WorkflowContext {
  /**
   * Function to generate text with model A.
   */
  generateWithModelA: (prompt: string) => Promise<GenerateResult>;

  /**
   * Function to generate text with model B.
   */
  generateWithModelB: (prompt: string) => Promise<GenerateResult>;

  /**
   * Function to validate code.
   */
  validateCode?: (code: string) => Promise<{
    valid: boolean;
    errors: string[];
    fixedCode?: string;
  }>;

  /**
   * Configuration for the workflow.
   */
  config: MultiAgentConfig;

  /**
   * Add a step to the history.
   */
  addStep: (step: Omit<AgentStep, 'timestamp' | 'durationMs'>) => void;
}

/**
 * Result of a generation call.
 */
export interface GenerateResult {
  text: string;
  reasoning?: string;
  usage?: LanguageModelUsage;
  toolCalls?: unknown[];
  toolResults?: unknown[];
}

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Default system prompts for different agent roles.
 */
export const DEFAULT_SYSTEM_PROMPTS = {
  planner: `You are a system architect and planner. Your role is to:
1. Analyze the problem thoroughly
2. Break it down into clear, actionable steps
3. Consider edge cases and potential issues
4. Provide a detailed implementation plan

Format your response as a numbered list of steps that can be followed to implement the solution.`,

  executor: `You are an expert implementer. Your role is to:
1. Follow the provided plan precisely
2. Write clean, well-documented code
3. Handle edge cases mentioned in the plan
4. Ensure the implementation is complete and functional

Provide only the implementation code with necessary comments.`,

  proposer: `You are a solution architect. Your role is to:
1. Analyze the problem carefully
2. Propose a complete solution
3. Consider best practices and patterns
4. Write clean, maintainable code

Provide your solution with explanations for key design decisions.`,

  critic: `You are a code reviewer and critic. Your role is to:
1. Review the proposed solution critically
2. Identify any bugs, errors, or issues
3. Suggest improvements for performance and readability
4. Verify edge cases are handled

Provide specific, actionable feedback. Be thorough but constructive.`
} as const;
