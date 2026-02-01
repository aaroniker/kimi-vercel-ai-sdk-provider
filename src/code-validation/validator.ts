/**
 * Code validator implementation.
 * @module
 */

import type { CodeValidationConfig, FixAttempt, SupportedLanguage, ValidationError, ValidationResult } from './types';
import { detectLanguage, extractPrimaryCode } from './detector';

// ============================================================================
// Types
// ============================================================================

/**
 * Function to generate text from a model.
 */
export type GenerateTextFunction = (prompt: string) => Promise<{
  text: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
}>;

/**
 * Options for creating a code validator.
 */
export interface CodeValidatorOptions {
  /**
   * Function to generate text (for fix attempts).
   */
  generateText: GenerateTextFunction;

  /**
   * Function to execute code using the code interpreter.
   * Should return output or throw on error.
   */
  executeCode?: (code: string, language: string) => Promise<string>;
}

// ============================================================================
// CodeValidator Class
// ============================================================================

/**
 * Validates code and attempts to fix errors automatically.
 *
 * @example
 * ```ts
 * const validator = new CodeValidator({
 *   generateText: async (prompt) => {
 *     const result = await generateText({ model, prompt });
 *     return { text: result.text };
 *   },
 * });
 *
 * const result = await validator.validate(code, {
 *   enabled: true,
 *   maxAttempts: 3,
 *   language: 'javascript',
 * });
 * ```
 */
export class CodeValidator {
  private generateText: GenerateTextFunction;
  private executeCode?: (code: string, language: string) => Promise<string>;

  constructor(options: CodeValidatorOptions) {
    this.generateText = options.generateText;
    this.executeCode = options.executeCode;
  }

  /**
   * Validate code and optionally fix errors.
   *
   * @param code - The code to validate
   * @param config - Validation configuration
   * @param originalPrompt - The original user prompt (for context in fixes)
   * @returns Validation result
   */
  async validate(code: string, config: CodeValidationConfig, originalPrompt: string = ''): Promise<ValidationResult> {
    const {
      maxAttempts = 3,
      language: configLanguage = 'auto',
      executionTimeoutMs = 30000,
      strictness = 'strict',
      returnPartialFix = true
    } = config;

    // Detect language if auto
    const language = configLanguage === 'auto' ? detectLanguage(code).language : configLanguage;

    let currentCode = code;
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationError[] = [];
    const fixHistory: FixAttempt[] = [];
    let attempts = 0;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;

      // Validate the current code
      const validationResult = await this.validateCode(currentCode, language, strictness, executionTimeoutMs);

      // Collect errors and warnings
      const newErrors = validationResult.errors.filter(
        (e) => !allErrors.some((existing) => existing.message === e.message)
      );
      allErrors.push(...newErrors);
      allWarnings.push(...validationResult.warnings);

      // If valid, we're done
      if (validationResult.valid) {
        return {
          valid: true,
          errors: [],
          warnings: allWarnings,
          output: validationResult.output,
          executionTimeMs: validationResult.executionTimeMs,
          attempts,
          finalCode: currentCode,
          originalCode: code,
          language,
          fixHistory
        };
      }

      // If this is the last attempt, don't try to fix
      if (i === maxAttempts - 1) {
        break;
      }

      // Try to fix the errors
      const fixResult = await this.attemptFix(currentCode, validationResult.errors, language, originalPrompt);

      fixHistory.push({
        attempt: attempts,
        codeBefore: currentCode,
        codeAfter: fixResult.code,
        errorsAddressed: validationResult.errors,
        success: false // Will be updated if next validation passes
      });

      if (fixResult.fixed) {
        currentCode = fixResult.code;
      } else {
        // Can't fix, stop trying
        break;
      }
    }

    // Return failed result
    return {
      valid: false,
      errors: allErrors,
      warnings: allWarnings,
      attempts,
      finalCode: returnPartialFix ? currentCode : code,
      originalCode: code,
      language,
      fixHistory
    };
  }

  /**
   * Validate code without attempting fixes.
   */
  private async validateCode(
    code: string,
    language: SupportedLanguage,
    strictness: string,
    _timeoutMs: number
  ): Promise<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    output?: string;
    executionTimeMs?: number;
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Static analysis first
    const staticErrors = this.performStaticAnalysis(code, language);
    errors.push(...staticErrors);

    // If we have critical syntax errors, don't try to execute
    if (staticErrors.some((e) => e.type === 'syntax' && e.severity === 'error')) {
      return { valid: false, errors, warnings };
    }

    // Try to execute if we have an executor
    if (this.executeCode) {
      try {
        const startTime = Date.now();
        const output = await this.executeCode(code, language);
        const executionTimeMs = Date.now() - startTime;

        // Check output for error patterns
        const runtimeErrors = this.detectRuntimeErrors(output);
        errors.push(...runtimeErrors);

        if (runtimeErrors.length === 0) {
          return {
            valid: true,
            errors: [],
            warnings,
            output,
            executionTimeMs
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Execution failed';
        errors.push({
          type: 'runtime',
          message,
          severity: 'error'
        });
      }
    }

    // If no executor, use LLM to validate
    if (!this.executeCode && strictness !== 'lenient') {
      const llmValidation = await this.validateWithLLM(code, language);
      errors.push(...llmValidation.errors);
      warnings.push(...llmValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform static analysis on code.
   */
  private performStaticAnalysis(code: string, language: SupportedLanguage): ValidationError[] {
    const errors: ValidationError[] = [];

    // Language-specific checks
    switch (language) {
      case 'javascript':
      case 'typescript':
        errors.push(...this.analyzeJavaScript(code));
        break;
      case 'python':
        errors.push(...this.analyzePython(code));
        break;
      default:
        errors.push(...this.analyzeGeneric(code));
    }

    return errors;
  }

  /**
   * Analyze JavaScript/TypeScript code.
   */
  private analyzeJavaScript(code: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for common syntax issues
    const patterns = [
      { pattern: /\bif\s*\([^)]*\)\s*[^{](?!.*[;{])/, message: 'Missing braces after if statement' },
      { pattern: /\bfor\s*\([^)]*\)\s*[^{](?!.*[;{])/, message: 'Missing braces after for loop' },
      { pattern: /==(?!=)/, message: 'Use === instead of == for strict equality', isWarning: true },
      { pattern: /!=(?!=)/, message: 'Use !== instead of != for strict inequality', isWarning: true },
      { pattern: /\bconsole\.log\(/, message: 'Console.log found - remove for production', isWarning: true }
    ];

    // Check bracket balance
    const bracketBalance = this.checkBracketBalance(code);
    if (!bracketBalance.valid) {
      errors.push({
        type: 'syntax',
        message: bracketBalance.message,
        severity: 'error'
      });
    }

    // Check patterns
    for (const { pattern, message, isWarning } of patterns) {
      if (pattern.test(code)) {
        errors.push({
          type: isWarning ? 'style' : 'syntax',
          message,
          severity: isWarning ? 'warning' : 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Analyze Python code.
   */
  private analyzePython(code: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check indentation consistency
    const lines = code.split('\n');
    let indentUnit: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }

      const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;

      // Detect indent unit
      if (indentUnit === null && leadingSpaces > 0) {
        indentUnit = leadingSpaces;
      }

      // Check for mixed tabs and spaces
      if (/^\s*\t/.test(line) && /^\s* /.test(line)) {
        errors.push({
          type: 'style',
          message: 'Mixed tabs and spaces in indentation',
          line: i + 1,
          severity: 'warning'
        });
      }
    }

    // Check for common issues
    if (/\bprint\s+[^(]/.test(code)) {
      errors.push({
        type: 'syntax',
        message: 'Python 2 print statement syntax - use print() function',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Generic code analysis.
   */
  private analyzeGeneric(code: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check bracket balance
    const bracketBalance = this.checkBracketBalance(code);
    if (!bracketBalance.valid) {
      errors.push({
        type: 'syntax',
        message: bracketBalance.message,
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Check bracket balance in code.
   */
  private checkBracketBalance(code: string): { valid: boolean; message: string } {
    const stack: string[] = [];
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}'
    };

    // Remove strings and comments to avoid false positives
    const cleanCode = code
      .replace(/"[^"\\]*(\\.[^"\\]*)*"/g, '""')
      .replace(/'[^'\\]*(\\.[^'\\]*)*'/g, "''")
      .replace(/`[^`\\]*(\\.[^`\\]*)*`/g, '``')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/#.*$/gm, '');

    for (const char of cleanCode) {
      if (char in pairs) {
        stack.push(pairs[char]);
      } else if (Object.values(pairs).includes(char)) {
        if (stack.length === 0 || stack.pop() !== char) {
          return { valid: false, message: `Unmatched bracket: ${char}` };
        }
      }
    }

    if (stack.length > 0) {
      return { valid: false, message: `Missing closing bracket: ${stack[stack.length - 1]}` };
    }

    return { valid: true, message: '' };
  }

  /**
   * Detect runtime errors from execution output.
   */
  private detectRuntimeErrors(output: string): ValidationError[] {
    const errors: ValidationError[] = [];

    const errorPatterns = [
      { pattern: /SyntaxError:\s*(.+)/i, type: 'syntax' as const },
      { pattern: /ReferenceError:\s*(.+)/i, type: 'runtime' as const },
      { pattern: /TypeError:\s*(.+)/i, type: 'runtime' as const },
      { pattern: /RangeError:\s*(.+)/i, type: 'runtime' as const },
      { pattern: /Error:\s*(.+)/i, type: 'runtime' as const },
      { pattern: /Exception:\s*(.+)/i, type: 'runtime' as const },
      { pattern: /Traceback \(most recent call last\)/i, type: 'runtime' as const }
    ];

    for (const { pattern, type } of errorPatterns) {
      const match = output.match(pattern);
      if (match) {
        errors.push({
          type,
          message: match[1] || match[0],
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Use LLM to validate code.
   */
  private async validateWithLLM(
    code: string,
    language: SupportedLanguage
  ): Promise<{ errors: ValidationError[]; warnings: ValidationError[] }> {
    const prompt = `Analyze this ${language} code for errors. Only report actual bugs, not style preferences.
Return JSON format: {"errors": [{"message": "...", "line": N, "type": "syntax|runtime|logic"}], "warnings": [{"message": "..."}]}
If no errors, return: {"errors": [], "warnings": []}

Code:
\`\`\`${language}
${code}
\`\`\`

Respond ONLY with the JSON object, no other text.`;

    try {
      const result = await this.generateText(prompt);
      const parsed = JSON.parse(result.text);

      return {
        errors: (parsed.errors || []).map((e: { message: string; line?: number; type?: string }) => {
          return {
            type: e.type || 'logic',
            message: e.message,
            line: e.line,
            severity: 'error' as const
          };
        }),
        warnings: (parsed.warnings || []).map((w: { message: string }) => {
          return {
            type: 'style' as const,
            message: w.message,
            severity: 'warning' as const
          };
        })
      };
    } catch {
      // LLM validation failed, return empty
      return { errors: [], warnings: [] };
    }
  }

  /**
   * Attempt to fix errors in code.
   */
  private async attemptFix(
    code: string,
    errors: ValidationError[],
    language: SupportedLanguage,
    originalPrompt: string
  ): Promise<{ fixed: boolean; code: string }> {
    const errorList = errors.map((e) => `- ${e.type}: ${e.message}${e.line ? ` (line ${e.line})` : ''}`).join('\n');

    const prompt = `Fix the following errors in this ${language} code.

${originalPrompt ? `Original request: ${originalPrompt}\n` : ''}
Errors to fix:
${errorList}

Current code:
\`\`\`${language}
${code}
\`\`\`

Provide ONLY the fixed code wrapped in a code block. No explanations.`;

    try {
      const result = await this.generateText(prompt);
      const extractedCode = extractPrimaryCode(result.text);

      if (extractedCode && extractedCode !== code) {
        return { fixed: true, code: extractedCode };
      }
    } catch {
      // Fix attempt failed
    }

    return { fixed: false, code };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple validation result for code that passed without issues.
 */
export function createPassedValidationResult(code: string, language: string, output?: string): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    output,
    attempts: 1,
    finalCode: code,
    originalCode: code,
    language
  };
}

/**
 * Create a validation result for code that failed.
 */
export function createFailedValidationResult(
  code: string,
  language: string,
  errors: ValidationError[]
): ValidationResult {
  return {
    valid: false,
    errors,
    warnings: [],
    attempts: 1,
    finalCode: code,
    originalCode: code,
    language
  };
}
