import { describe, expect, it, vi } from 'vitest';
import {
  containsCode,
  detectLanguage,
  extractCodeBlocks,
  extractPrimaryCode,
  getFileExtension
} from '../code-validation/detector';
import {
  CodeValidator,
  createFailedValidationResult,
  createPassedValidationResult
} from '../code-validation/validator';

describe('Code Validation', () => {
  describe('detectLanguage', () => {
    it('detects TypeScript', () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }
        
        const user: User = { name: 'John', age: 30 };
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('typescript');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators).toContain('interface');
    });

    it('detects JavaScript', () => {
      const code = `
        const express = require('express');
        const app = express();
        
        app.get('/', (req, res) => {
          res.send('Hello World!');
        });
        
        module.exports = app;
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('javascript');
      expect(result.indicators).toContain('require');
    });

    it('detects Python', () => {
      const code = `
        def hello_world():
            print("Hello, World!")
        
        if __name__ == "__main__":
            hello_world()
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('python');
      expect(result.indicators).toContain('def');
      expect(result.indicators).toContain('main_guard');
    });

    it('detects Java', () => {
      const code = `
        public class HelloWorld {
            public static void main(String[] args) {
                System.out.println("Hello, World!");
            }
        }
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('java');
      expect(result.indicators).toContain('main_method');
    });

    it('detects Go', () => {
      const code = `
        package main
        
        import "fmt"
        
        func main() {
            fmt.Println("Hello, World!")
        }
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('go');
      expect(result.indicators).toContain('package_main');
    });

    it('detects Rust', () => {
      const code = `
        fn main() {
            let mut x = 5;
            println!("The value is: {}", x);
        }
      `;
      const result = detectLanguage(code);
      expect(result.language).toBe('rust');
      expect(result.indicators).toContain('fn');
      expect(result.indicators).toContain('let_mut');
    });
  });

  describe('extractCodeBlocks', () => {
    it('extracts fenced code blocks', () => {
      const text = `
        Here is some code:
        
        \`\`\`javascript
        const x = 5;
        console.log(x);
        \`\`\`
        
        And another:
        
        \`\`\`python
        print("hello")
        \`\`\`
      `;

      const result = extractCodeBlocks(text);
      expect(result.hasCode).toBe(true);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].language).toBe('javascript');
      expect(result.blocks[0].code).toContain('const x = 5');
      expect(result.blocks[1].language).toBe('python');
    });

    it('handles code blocks without language annotation', () => {
      const text = `
        \`\`\`
        some code here
        \`\`\`
      `;

      const result = extractCodeBlocks(text);
      expect(result.hasCode).toBe(true);
      expect(result.blocks[0].language).toBeUndefined();
    });

    it('returns empty when no code found', () => {
      const text = 'Just plain text without any code.';
      const result = extractCodeBlocks(text);
      expect(result.hasCode).toBe(false);
      expect(result.blocks).toHaveLength(0);
    });
  });

  describe('extractPrimaryCode', () => {
    it('returns the largest code block', () => {
      const text = `
        \`\`\`
        small
        \`\`\`
        
        \`\`\`
        this is a much larger code block
        with multiple lines
        of code
        \`\`\`
      `;

      const code = extractPrimaryCode(text);
      expect(code).toContain('much larger');
    });

    it('returns undefined for no code', () => {
      const code = extractPrimaryCode('no code here');
      expect(code).toBeUndefined();
    });
  });

  describe('containsCode', () => {
    it('returns true for code fences', () => {
      expect(containsCode('```\ncode\n```')).toBe(true);
    });

    it('returns true for code-like patterns', () => {
      expect(containsCode('function test() { return 42; }')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(containsCode('Hello, this is just text.')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('returns correct extensions', () => {
      expect(getFileExtension('javascript')).toBe('js');
      expect(getFileExtension('typescript')).toBe('ts');
      expect(getFileExtension('python')).toBe('py');
      expect(getFileExtension('java')).toBe('java');
      expect(getFileExtension('go')).toBe('go');
      expect(getFileExtension('rust')).toBe('rs');
      expect(getFileExtension('auto')).toBe('txt');
    });
  });

  describe('CodeValidator', () => {
    const createMockGenerator = (response: string) => vi.fn().mockResolvedValue({ text: response });

    it('validates correct code', async () => {
      const validator = new CodeValidator({
        generateText: createMockGenerator('{"errors": [], "warnings": []}')
      });

      const result = await validator.validate(
        'function add(a, b) { return a + b; }',
        { enabled: true, language: 'javascript' },
        ''
      );

      // Static analysis should pass for this simple function
      expect(result.attempts).toBe(1);
      expect(result.language).toBe('javascript');
    });

    it('detects syntax errors', async () => {
      const validator = new CodeValidator({
        generateText: createMockGenerator(
          '{"errors": [{"message": "Missing bracket", "type": "syntax"}], "warnings": []}'
        )
      });

      const result = await validator.validate(
        'function test( { return 42; }', // Missing closing paren
        { enabled: true, language: 'javascript', maxAttempts: 1 },
        ''
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('respects maxAttempts', async () => {
      let attempts = 0;
      const validator = new CodeValidator({
        generateText: vi.fn().mockImplementation(async () => {
          attempts++;
          return { text: '{"errors": [{"message": "error"}], "warnings": []}' };
        })
      });

      const result = await validator.validate('broken code {{{', { enabled: true, maxAttempts: 2 }, '');

      expect(result.attempts).toBeLessThanOrEqual(2);
      expect(attempts).toBe(1);
    });
  });

  describe('utility functions', () => {
    it('createPassedValidationResult creates valid result', () => {
      const result = createPassedValidationResult('code', 'javascript', 'output');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('output');
    });

    it('createFailedValidationResult creates invalid result', () => {
      const result = createFailedValidationResult('code', 'python', [
        { type: 'syntax', message: 'Error', severity: 'error' }
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});
