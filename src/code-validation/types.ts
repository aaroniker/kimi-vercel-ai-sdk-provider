/**
 * Types for code validation functionality.
 * @module
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Supported programming languages for code validation.
 */
export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'auto';

/**
 * Validation strictness levels.
 */
export type ValidationStrictness = 'lenient' | 'strict' | 'maximum';

/**
 * Configuration for code validation.
 */
export interface CodeValidationConfig {
  /**
   * Enable automatic code validation.
   * @default false
   */
  enabled: boolean;

  /**
   * Maximum number of attempts to fix errors.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Language to validate (auto-detected if not specified).
   * @default 'auto'
   */
  language?: SupportedLanguage;

  /**
   * Timeout for each code execution attempt (ms).
   * @default 30000
   */
  executionTimeoutMs?: number;

  /**
   * Whether to include test cases in validation.
   * If true, the provider will look for test patterns in the prompt.
   * @default true
   */
  includeTests?: boolean;

  /**
   * Validation strictness.
   * - 'lenient': Check for runtime errors only
   * - 'strict': Check syntax + runtime + style
   * - 'maximum': Also verify output correctness
   * @default 'strict'
   */
  strictness?: ValidationStrictness;

  /**
   * Custom validation function for specialized needs.
   */
  customValidator?: (code: string, language: string) => Promise<ValidationResult>;

  /**
   * Whether to return the fixed code even if validation fails.
   * @default true
   */
  returnPartialFix?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Types of validation errors.
 */
export type ValidationErrorType = 'syntax' | 'runtime' | 'timeout' | 'test' | 'style' | 'logic';

/**
 * Severity of validation errors.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation error.
 */
export interface ValidationError {
  /**
   * Type of the error.
   */
  type: ValidationErrorType;

  /**
   * Error message.
   */
  message: string;

  /**
   * Line number where the error occurred (1-indexed).
   */
  line?: number;

  /**
   * Column number where the error occurred (1-indexed).
   */
  column?: number;

  /**
   * Severity of the error.
   */
  severity: ValidationSeverity;

  /**
   * The problematic code snippet.
   */
  snippet?: string;

  /**
   * Suggested fix (if available).
   */
  suggestion?: string;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of validating and potentially fixing code.
 */
export interface ValidationResult {
  /**
   * Whether the final code is valid.
   */
  valid: boolean;

  /**
   * All errors encountered during validation.
   */
  errors: ValidationError[];

  /**
   * Warnings that don't prevent execution.
   */
  warnings: ValidationError[];

  /**
   * Output from successful execution (if any).
   */
  output?: string;

  /**
   * Time taken for execution (ms).
   */
  executionTimeMs?: number;

  /**
   * Number of validation/fix attempts made.
   */
  attempts: number;

  /**
   * The final code after any fixes.
   */
  finalCode: string;

  /**
   * The original code before any fixes.
   */
  originalCode: string;

  /**
   * Language that was detected/used.
   */
  language: string;

  /**
   * History of code changes during fix attempts.
   */
  fixHistory?: FixAttempt[];
}

/**
 * A single fix attempt.
 */
export interface FixAttempt {
  /**
   * Attempt number (1-indexed).
   */
  attempt: number;

  /**
   * The code before this fix.
   */
  codeBefore: string;

  /**
   * The code after this fix.
   */
  codeAfter: string;

  /**
   * Errors that were addressed.
   */
  errorsAddressed: ValidationError[];

  /**
   * Whether this fix resolved all errors.
   */
  success: boolean;
}

// ============================================================================
// Detection Types
// ============================================================================

/**
 * Result of language detection.
 */
export interface LanguageDetectionResult {
  /**
   * Detected language.
   */
  language: SupportedLanguage;

  /**
   * Confidence score (0-1).
   */
  confidence: number;

  /**
   * Indicators that led to this detection.
   */
  indicators: string[];
}

/**
 * Result of code extraction from text.
 */
export interface CodeExtractionResult {
  /**
   * Extracted code blocks.
   */
  blocks: CodeBlock[];

  /**
   * Whether any code was found.
   */
  hasCode: boolean;
}

/**
 * A code block extracted from text.
 */
export interface CodeBlock {
  /**
   * The code content.
   */
  code: string;

  /**
   * Language annotation (if provided).
   */
  language?: string;

  /**
   * Start position in the original text.
   */
  startIndex: number;

  /**
   * End position in the original text.
   */
  endIndex: number;
}
