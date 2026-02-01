import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SYSTEM_PROMPTS, type WorkflowType } from '../multi-agent/types';
import { WorkflowRunner, createEmptyMultiAgentResult } from '../multi-agent/workflows';

describe('Multi-Agent Collaboration', () => {
  const createMockGenerator = (responses: Record<string, string>) =>
    vi.fn().mockImplementation(async (modelId: string) => {
      return {
        text: responses[modelId] || `Response from ${modelId}`,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      };
    });

  describe('WorkflowRunner', () => {
    describe('planner-executor workflow', () => {
      it('runs planner-executor workflow', async () => {
        const generator = createMockGenerator({
          'kimi-k2.5-thinking': '1. Analyze requirements\n2. Design solution\n3. Implement',
          'kimi-k2.5': 'function solve() { return 42; }'
        });

        const runner = new WorkflowRunner(generator);
        const result = await runner.run('Create a function', {
          workflow: 'planner-executor',
          modelA: 'kimi-k2.5-thinking',
          modelB: 'kimi-k2.5'
        });

        expect(result.text).toContain('function solve');
        expect(result.reasoning).toContain('Analyze requirements');
        expect(result.intermediateSteps).toHaveLength(2);
        expect(result.metadata.workflow).toBe('planner-executor');
        expect(result.metadata.models).toContain('kimi-k2.5-thinking');
        expect(result.metadata.models).toContain('kimi-k2.5');
      });

      it('includes validation step when enabled', async () => {
        const generator = createMockGenerator({
          'kimi-k2.5-thinking': 'Plan step',
          'kimi-k2.5': '```javascript\nconst x = 5;\n```'
        });

        const validateCode = vi.fn().mockResolvedValue({
          valid: true,
          errors: []
        });

        const runner = new WorkflowRunner(generator, validateCode);
        const result = await runner.run('Create code', {
          workflow: 'planner-executor',
          validateCode: true
        });

        expect(result.intermediateSteps.length).toBeGreaterThanOrEqual(2);
        expect(result.validation).toBeDefined();
        expect(result.validation?.valid).toBe(true);
      });
    });

    describe('proposer-critic workflow', () => {
      it('runs proposer-critic workflow', async () => {
        const generator = createMockGenerator({
          'kimi-k2.5': 'First attempt at solution',
          'kimi-k2.5-thinking': 'Consider these improvements...'
        });

        const runner = new WorkflowRunner(generator);
        const result = await runner.run('Solve this problem', {
          workflow: 'proposer-critic',
          iterations: 2,
          modelA: 'kimi-k2.5',
          modelB: 'kimi-k2.5-thinking'
        });

        expect(result.metadata.workflow).toBe('proposer-critic');
        expect(result.intermediateSteps.length).toBeGreaterThanOrEqual(2);

        const roles = result.intermediateSteps.map((s) => s.role);
        expect(roles).toContain('proposer');
        expect(roles).toContain('critic');
      });

      it('iterates specified number of times', async () => {
        const generator = vi.fn().mockResolvedValue({
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        });

        const runner = new WorkflowRunner(generator);
        await runner.run('Task', {
          workflow: 'proposer-critic',
          iterations: 3
        });

        // 3 proposer iterations + 2 critic iterations (critic doesn't run on last)
        expect(generator).toHaveBeenCalledTimes(5);
      });
    });

    describe('debate workflow', () => {
      it('runs debate workflow', async () => {
        const generator = createMockGenerator({
          'kimi-k2.5': 'Position A'
        });

        const runner = new WorkflowRunner(generator);
        const result = await runner.run('Debate this topic', {
          workflow: 'debate',
          iterations: 2
        });

        expect(result.metadata.workflow).toBe('debate');
        expect(result.intermediateSteps.length).toBeGreaterThan(0);
      });
    });

    describe('custom workflow', () => {
      it('runs custom workflow', async () => {
        const generator = createMockGenerator({});
        const runner = new WorkflowRunner(generator);

        const customWorkflow = vi.fn().mockResolvedValue({
          text: 'Custom result',
          intermediateSteps: [
            {
              agent: 'Custom',
              role: 'custom',
              action: 'Custom action',
              output: 'Custom output',
              timestamp: Date.now(),
              durationMs: 100
            }
          ],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: {
            workflow: 'custom',
            iterations: 1,
            durationMs: 0,
            models: [],
            validationEnabled: false,
            success: true
          }
        });

        const result = await runner.run('Task', {
          workflow: 'custom',
          customWorkflow
        });

        expect(customWorkflow).toHaveBeenCalled();
        expect(result.text).toBe('Custom result');
      });

      it('throws without customWorkflow function', async () => {
        const generator = createMockGenerator({});
        const runner = new WorkflowRunner(generator);

        await expect(runner.run('Task', { workflow: 'custom' })).rejects.toThrow(
          'Custom workflow requires customWorkflow function'
        );
      });
    });

    describe('error handling', () => {
      it('throws for unknown workflow', async () => {
        const generator = createMockGenerator({});
        const runner = new WorkflowRunner(generator);

        await expect(runner.run('Task', { workflow: 'invalid' as WorkflowType })).rejects.toThrow(
          'Unknown workflow type'
        );
      });
    });
  });

  describe('createEmptyMultiAgentResult', () => {
    it('creates empty result with error', () => {
      const result = createEmptyMultiAgentResult('planner-executor', 'Something failed');

      expect(result.text).toBe('');
      expect(result.intermediateSteps).toHaveLength(0);
      expect(result.metadata.success).toBe(false);
      expect(result.metadata.error).toBe('Something failed');
      expect(result.metadata.workflow).toBe('planner-executor');
    });
  });

  describe('DEFAULT_SYSTEM_PROMPTS', () => {
    it('has all required prompts', () => {
      expect(DEFAULT_SYSTEM_PROMPTS.planner).toBeDefined();
      expect(DEFAULT_SYSTEM_PROMPTS.executor).toBeDefined();
      expect(DEFAULT_SYSTEM_PROMPTS.proposer).toBeDefined();
      expect(DEFAULT_SYSTEM_PROMPTS.critic).toBeDefined();
    });

    it('prompts are non-empty strings', () => {
      expect(typeof DEFAULT_SYSTEM_PROMPTS.planner).toBe('string');
      expect(DEFAULT_SYSTEM_PROMPTS.planner.length).toBeGreaterThan(50);
    });
  });
});
