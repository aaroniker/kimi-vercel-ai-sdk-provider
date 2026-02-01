/**
 * Multi-agent workflow implementations.
 * @module
 */

import type {
  AgentStep,
  GenerateResult,
  LanguageModelUsage,
  MultiAgentConfig,
  MultiAgentMetadata,
  MultiAgentResult,
  WorkflowContext
} from './types';
import { extractPrimaryCode } from '../code-validation/detector';
import { DEFAULT_SYSTEM_PROMPTS } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Function type for generating text.
 */
export type GenerateTextFunction = (modelId: string, prompt: string, systemPrompt?: string) => Promise<GenerateResult>;

/**
 * Function type for validating code.
 */
export type ValidateCodeFunction = (code: string) => Promise<{
  valid: boolean;
  errors: string[];
  fixedCode?: string;
}>;

/**
 * Options for running a workflow.
 */
export interface WorkflowRunnerOptions {
  /**
   * The user's prompt.
   */
  prompt: string;

  /**
   * Workflow configuration.
   */
  config: MultiAgentConfig;

  /**
   * Function to generate text.
   */
  generateText: GenerateTextFunction;

  /**
   * Optional function to validate code.
   */
  validateCode?: ValidateCodeFunction;
}

// ============================================================================
// WorkflowRunner Class
// ============================================================================

/**
 * Runner for multi-agent workflows.
 */
export class WorkflowRunner {
  private generateText: GenerateTextFunction;
  private validateCode?: ValidateCodeFunction;

  constructor(generateText: GenerateTextFunction, validateCode?: ValidateCodeFunction) {
    this.generateText = generateText;
    this.validateCode = validateCode;
  }

  /**
   * Run a multi-agent workflow.
   */
  async run(prompt: string, config: MultiAgentConfig): Promise<MultiAgentResult> {
    const startTime = Date.now();

    switch (config.workflow) {
      case 'planner-executor':
        return this.runPlannerExecutor(prompt, config, startTime);

      case 'proposer-critic':
        return this.runProposerCritic(prompt, config, startTime);

      case 'debate':
        return this.runDebate(prompt, config, startTime);

      case 'custom':
        if (!config.customWorkflow) {
          throw new Error('Custom workflow requires customWorkflow function');
        }
        return this.runCustom(prompt, config, startTime);

      default:
        throw new Error(`Unknown workflow type: ${config.workflow}`);
    }
  }

  /**
   * Planner-Executor workflow.
   */
  private async runPlannerExecutor(
    prompt: string,
    config: MultiAgentConfig,
    startTime: number
  ): Promise<MultiAgentResult> {
    const steps: AgentStep[] = [];
    let totalUsage: LanguageModelUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const modelA = config.modelA || 'kimi-k2.5-thinking';
    const modelB = config.modelB || 'kimi-k2.5';

    // Step 1: Planner creates plan
    const planStart = Date.now();
    const plannerPrompt = `${config.systemPrompts?.planner || DEFAULT_SYSTEM_PROMPTS.planner}

Problem to solve:
${prompt}

Provide a detailed step-by-step plan.`;

    const planResult = await this.generateText(modelA, plannerPrompt);

    steps.push({
      agent: 'A (Planner)',
      role: 'planner',
      action: 'Create implementation plan',
      input: prompt,
      output: planResult.text,
      timestamp: Date.now(),
      durationMs: Date.now() - planStart,
      usage: planResult.usage,
      model: modelA
    });

    totalUsage = this.addUsage(totalUsage, planResult.usage);

    // Step 2: Executor implements
    const execStart = Date.now();
    const executorPrompt = `${config.systemPrompts?.executor || DEFAULT_SYSTEM_PROMPTS.executor}

Plan to implement:
${planResult.text}

Original problem: ${prompt}

Implement the solution following the plan.`;

    const execResult = await this.generateText(modelB, executorPrompt);

    steps.push({
      agent: 'B (Executor)',
      role: 'executor',
      action: 'Implement solution',
      input: planResult.text,
      output: execResult.text,
      timestamp: Date.now(),
      durationMs: Date.now() - execStart,
      usage: execResult.usage,
      model: modelB
    });

    totalUsage = this.addUsage(totalUsage, execResult.usage);

    // Step 3: Optional validation
    let validation: MultiAgentResult['validation'];
    if (config.validateCode && this.validateCode) {
      const code = extractPrimaryCode(execResult.text);
      if (code) {
        const validStart = Date.now();
        const validResult = await this.validateCode(code);

        steps.push({
          agent: 'Validator',
          role: 'validator',
          action: 'Validate code',
          input: code,
          output: validResult.valid ? 'Code is valid' : `Errors: ${validResult.errors.join(', ')}`,
          timestamp: Date.now(),
          durationMs: Date.now() - validStart
        });

        validation = {
          valid: validResult.valid,
          errors: validResult.errors,
          finalCode: validResult.fixedCode || code
        };
      }
    }

    return {
      text: execResult.text,
      reasoning: planResult.text,
      intermediateSteps: steps,
      usage: totalUsage,
      metadata: this.buildMetadata(config, steps, startTime, [modelA, modelB]),
      validation
    };
  }

  /**
   * Proposer-Critic workflow.
   */
  private async runProposerCritic(
    prompt: string,
    config: MultiAgentConfig,
    startTime: number
  ): Promise<MultiAgentResult> {
    const steps: AgentStep[] = [];
    let totalUsage: LanguageModelUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const modelA = config.modelA || 'kimi-k2.5';
    const modelB = config.modelB || 'kimi-k2.5-thinking';
    const iterations = config.iterations || 2;

    let currentSolution = '';
    let critique = '';

    for (let i = 0; i < iterations; i++) {
      // Proposer generates/improves solution
      const proposeStart = Date.now();
      const proposerPrompt =
        i === 0
          ? `${config.systemPrompts?.proposer || DEFAULT_SYSTEM_PROMPTS.proposer}

Problem: ${prompt}

Provide your solution.`
          : `${config.systemPrompts?.proposer || DEFAULT_SYSTEM_PROMPTS.proposer}

Problem: ${prompt}

Previous solution:
${currentSolution}

Critique/feedback to address:
${critique}

Provide an improved solution addressing the feedback.`;

      const proposeResult = await this.generateText(modelA, proposerPrompt);
      currentSolution = proposeResult.text;

      steps.push({
        agent: 'A (Proposer)',
        role: 'proposer',
        action: `Generate solution (iteration ${i + 1})`,
        input: i === 0 ? prompt : critique,
        output: currentSolution,
        timestamp: Date.now(),
        durationMs: Date.now() - proposeStart,
        usage: proposeResult.usage,
        model: modelA
      });

      totalUsage = this.addUsage(totalUsage, proposeResult.usage);

      // Critic reviews (except on last iteration)
      if (i < iterations - 1) {
        const critiqueStart = Date.now();
        const criticPrompt = `${config.systemPrompts?.critic || DEFAULT_SYSTEM_PROMPTS.critic}

Original problem: ${prompt}

Solution to review:
${currentSolution}

Provide detailed feedback and suggestions for improvement.`;

        const critiqueResult = await this.generateText(modelB, criticPrompt);
        critique = critiqueResult.text;

        steps.push({
          agent: 'B (Critic)',
          role: 'critic',
          action: `Critique solution (iteration ${i + 1})`,
          input: currentSolution,
          output: critique,
          timestamp: Date.now(),
          durationMs: Date.now() - critiqueStart,
          usage: critiqueResult.usage,
          model: modelB
        });

        totalUsage = this.addUsage(totalUsage, critiqueResult.usage);
      }
    }

    // Optional validation
    let validation: MultiAgentResult['validation'];
    if (config.validateCode && this.validateCode) {
      const code = extractPrimaryCode(currentSolution);
      if (code) {
        const validResult = await this.validateCode(code);
        validation = {
          valid: validResult.valid,
          errors: validResult.errors,
          finalCode: validResult.fixedCode || code
        };
      }
    }

    return {
      text: currentSolution,
      reasoning: critique,
      intermediateSteps: steps,
      usage: totalUsage,
      metadata: this.buildMetadata(config, steps, startTime, [modelA, modelB]),
      validation
    };
  }

  /**
   * Debate workflow.
   */
  private async runDebate(prompt: string, config: MultiAgentConfig, startTime: number): Promise<MultiAgentResult> {
    const steps: AgentStep[] = [];
    let totalUsage: LanguageModelUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const modelA = config.modelA || 'kimi-k2.5';
    const modelB = config.modelB || 'kimi-k2.5';
    const iterations = config.iterations || 2;

    let positionA = '';
    let positionB = '';

    // Initial positions
    const initialPrompt = `Problem: ${prompt}

Provide your solution and reasoning.`;

    // Agent A's initial position
    const aStart = Date.now();
    const aResult = await this.generateText(modelA, initialPrompt);
    positionA = aResult.text;

    steps.push({
      agent: 'A',
      role: 'proposer',
      action: 'Initial position',
      input: prompt,
      output: positionA,
      timestamp: Date.now(),
      durationMs: Date.now() - aStart,
      usage: aResult.usage,
      model: modelA
    });

    totalUsage = this.addUsage(totalUsage, aResult.usage);

    // Agent B's initial position
    const bStart = Date.now();
    const bResult = await this.generateText(modelB, initialPrompt);
    positionB = bResult.text;

    steps.push({
      agent: 'B',
      role: 'proposer',
      action: 'Initial position',
      input: prompt,
      output: positionB,
      timestamp: Date.now(),
      durationMs: Date.now() - bStart,
      usage: bResult.usage,
      model: modelB
    });

    totalUsage = this.addUsage(totalUsage, bResult.usage);

    // Debate rounds
    for (let i = 0; i < iterations - 1; i++) {
      // A responds to B
      const aDebateStart = Date.now();
      const aDebatePrompt = `Problem: ${prompt}

Your previous position:
${positionA}

Other perspective:
${positionB}

Consider the other perspective. Either defend your position with additional reasoning, or revise it based on valid points. Provide your updated solution.`;

      const aDebateResult = await this.generateText(modelA, aDebatePrompt);
      positionA = aDebateResult.text;

      steps.push({
        agent: 'A',
        role: 'proposer',
        action: `Debate round ${i + 1}`,
        input: positionB,
        output: positionA,
        timestamp: Date.now(),
        durationMs: Date.now() - aDebateStart,
        usage: aDebateResult.usage,
        model: modelA
      });

      totalUsage = this.addUsage(totalUsage, aDebateResult.usage);

      // B responds to A
      const bDebateStart = Date.now();
      const bDebatePrompt = `Problem: ${prompt}

Your previous position:
${positionB}

Other perspective:
${positionA}

Consider the other perspective. Either defend your position with additional reasoning, or revise it based on valid points. Provide your updated solution.`;

      const bDebateResult = await this.generateText(modelB, bDebatePrompt);
      positionB = bDebateResult.text;

      steps.push({
        agent: 'B',
        role: 'proposer',
        action: `Debate round ${i + 1}`,
        input: positionA,
        output: positionB,
        timestamp: Date.now(),
        durationMs: Date.now() - bDebateStart,
        usage: bDebateResult.usage,
        model: modelB
      });

      totalUsage = this.addUsage(totalUsage, bDebateResult.usage);
    }

    // Synthesize final answer (use last response as primary)
    const finalText = positionA.length > positionB.length ? positionA : positionB;

    return {
      text: finalText,
      reasoning: `Debate synthesis from ${iterations} rounds`,
      intermediateSteps: steps,
      usage: totalUsage,
      metadata: this.buildMetadata(config, steps, startTime, [modelA, modelB])
    };
  }

  /**
   * Custom workflow.
   */
  private async runCustom(prompt: string, config: MultiAgentConfig, startTime: number): Promise<MultiAgentResult> {
    const steps: AgentStep[] = [];
    const modelA = config.modelA || 'kimi-k2.5';
    const modelB = config.modelB || 'kimi-k2.5';

    const context: WorkflowContext = {
      generateWithModelA: (p: string) => this.generateText(modelA, p),
      generateWithModelB: (p: string) => this.generateText(modelB, p),
      validateCode: this.validateCode,
      config,
      addStep: (step) => {
        steps.push({
          ...step,
          timestamp: Date.now(),
          durationMs: 0
        });
      }
    };

    const result = await config.customWorkflow!(prompt, context);

    // Merge steps if result doesn't include them
    if (result.intermediateSteps.length === 0 && steps.length > 0) {
      result.intermediateSteps = steps;
    }

    // Update metadata with timing
    result.metadata.durationMs = Date.now() - startTime;

    return result;
  }

  /**
   * Build metadata for result.
   */
  private buildMetadata(
    config: MultiAgentConfig,
    steps: AgentStep[],
    startTime: number,
    models: string[]
  ): MultiAgentMetadata {
    return {
      workflow: config.workflow,
      iterations: steps.length,
      durationMs: Date.now() - startTime,
      models: [...new Set(models)],
      validationEnabled: config.validateCode ?? false,
      success: true
    };
  }

  /**
   * Add usage stats.
   */
  private addUsage(a: LanguageModelUsage, b?: LanguageModelUsage): LanguageModelUsage {
    if (!b) {
      return a;
    }
    return {
      promptTokens: a.promptTokens + b.promptTokens,
      completionTokens: a.completionTokens + b.completionTokens,
      totalTokens: a.totalTokens + b.totalTokens
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an empty multi-agent result.
 */
export function createEmptyMultiAgentResult(workflow: MultiAgentConfig['workflow'], error: string): MultiAgentResult {
  return {
    text: '',
    intermediateSteps: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metadata: {
      workflow,
      iterations: 0,
      durationMs: 0,
      models: [],
      validationEnabled: false,
      success: false,
      error
    }
  };
}
