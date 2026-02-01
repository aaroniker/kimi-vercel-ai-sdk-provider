import { describe, expect, it } from 'vitest';
import { detectToolsFromPrompt, hasToolOptOut, shouldAutoEnableTools } from '../tools/auto-detect';

describe('Auto-detect Tools', () => {
  describe('detectToolsFromPrompt', () => {
    describe('web search detection', () => {
      it('detects direct search requests', () => {
        const result = detectToolsFromPrompt('Search for the latest news about AI');
        expect(result.webSearch).toBe(true);
        expect(result.webSearchConfidence).toBeGreaterThan(0.5);
        expect(result.webSearchMatches).toContain('direct_search');
      });

      it('detects current/latest information requests', () => {
        const result = detectToolsFromPrompt('What is the current price of Bitcoin?');
        expect(result.webSearch).toBe(true);
        expect(result.webSearchConfidence).toBeGreaterThan(0.7);
      });

      it('detects weather requests', () => {
        const result = detectToolsFromPrompt('What is the weather in New York today?');
        expect(result.webSearch).toBe(true);
        expect(result.webSearchMatches).toContain('weather');
      });

      it('detects news requests', () => {
        const result = detectToolsFromPrompt('What are the latest headlines about technology?');
        expect(result.webSearch).toBe(true);
      });

      it('does not detect web search for general questions', () => {
        const result = detectToolsFromPrompt('What is the capital of France?');
        expect(result.webSearch).toBe(false);
        expect(result.webSearchConfidence).toBeLessThan(0.3);
      });
    });

    describe('code interpreter detection', () => {
      it('detects write code requests', () => {
        const result = detectToolsFromPrompt('Write a function to sort an array');
        expect(result.codeInterpreter).toBe(true);
        expect(result.codeInterpreterConfidence).toBeGreaterThan(0.5);
        expect(result.codeInterpreterMatches).toContain('write_code');
      });

      it('detects calculation requests', () => {
        const result = detectToolsFromPrompt('Calculate 5 factorial');
        expect(result.codeInterpreter).toBe(true);
        expect(result.codeInterpreterMatches).toContain('calculate');
      });

      it('detects debug requests', () => {
        const result = detectToolsFromPrompt('Debug this code and find the error');
        expect(result.codeInterpreter).toBe(true);
        expect(result.codeInterpreterMatches).toContain('debug');
      });

      it('detects code execution requests', () => {
        const result = detectToolsFromPrompt('Run this script and show the output');
        expect(result.codeInterpreter).toBe(true);
        expect(result.codeInterpreterMatches).toContain('run_code');
      });

      it('detects code blocks in prompt', () => {
        const result = detectToolsFromPrompt(`
          Please help me with this code:
          \`\`\`javascript
          const x = 5;
          console.log(x);
          \`\`\`
        `);
        expect(result.codeInterpreter).toBe(true);
      });

      it('does not detect code interpreter for general questions', () => {
        const result = detectToolsFromPrompt('Tell me a joke');
        expect(result.codeInterpreter).toBe(false);
      });
    });

    describe('combined detection', () => {
      it('can detect both tools in one prompt', () => {
        const result = detectToolsFromPrompt(
          'Search for the latest Python tutorials and write a function to parse JSON'
        );
        expect(result.webSearch).toBe(true);
        expect(result.codeInterpreter).toBe(true);
      });

      it('respects custom confidence threshold', () => {
        const result = detectToolsFromPrompt('What is the price of something?', {
          confidenceThreshold: 0.9
        });
        // Price alone may not meet 0.9 threshold
        expect(result.webSearchConfidence).toBeLessThan(0.9);
      });
    });
  });

  describe('shouldAutoEnableTools', () => {
    it('returns simple boolean flags', () => {
      const result = shouldAutoEnableTools('Search for news about AI');
      expect(typeof result.webSearch).toBe('boolean');
      expect(typeof result.codeInterpreter).toBe('boolean');
      expect(result.webSearch).toBe(true);
    });

    it('handles empty prompts', () => {
      const result = shouldAutoEnableTools('');
      expect(result.webSearch).toBe(false);
      expect(result.codeInterpreter).toBe(false);
    });
  });

  describe('hasToolOptOut', () => {
    it('detects web search opt-out', () => {
      const result = hasToolOptOut("Don't search the web, just answer from memory");
      expect(result.webSearch).toBe(true);
      expect(result.codeInterpreter).toBe(false);
    });

    it('detects code execution opt-out', () => {
      const result = hasToolOptOut("Don't run or execute any code");
      expect(result.webSearch).toBe(false);
      expect(result.codeInterpreter).toBe(true);
    });

    it('detects both opt-outs', () => {
      const result = hasToolOptOut('Without searching online or running code, explain this concept');
      expect(result.webSearch).toBe(true);
      expect(result.codeInterpreter).toBe(true);
    });

    it('returns false when no opt-out', () => {
      const result = hasToolOptOut('Please help me with this task');
      expect(result.webSearch).toBe(false);
      expect(result.codeInterpreter).toBe(false);
    });
  });
});
