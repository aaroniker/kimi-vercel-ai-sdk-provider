/**
 * Auto-detection utilities for enabling tools based on prompt content.
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Result of auto-detecting which tools should be enabled.
 */
export interface AutoDetectToolsResult {
  /**
   * Whether web search should be enabled.
   */
  webSearch: boolean;

  /**
   * Whether code interpreter should be enabled.
   */
  codeInterpreter: boolean;

  /**
   * Confidence score (0-1) for web search detection.
   */
  webSearchConfidence: number;

  /**
   * Confidence score (0-1) for code interpreter detection.
   */
  codeInterpreterConfidence: number;

  /**
   * Patterns that matched for web search.
   */
  webSearchMatches: string[];

  /**
   * Patterns that matched for code interpreter.
   */
  codeInterpreterMatches: string[];
}

/**
 * Configuration for auto-detect behavior.
 */
export interface AutoDetectConfig {
  /**
   * Minimum confidence threshold to enable a tool.
   * @default 0.3
   */
  confidenceThreshold?: number;

  /**
   * Whether to include partial matches in detection.
   * @default true
   */
  includePartialMatches?: boolean;
}

// ============================================================================
// Detection Patterns
// ============================================================================

/**
 * Patterns that suggest web search would be helpful.
 * Each pattern has an associated confidence weight.
 */
const WEB_SEARCH_PATTERNS: Array<{ pattern: RegExp; weight: number; name: string }> = [
  // Direct search requests
  { pattern: /search\s+(for|the\s+web|online|internet)/i, weight: 1.0, name: 'direct_search' },
  { pattern: /look\s+up\b/i, weight: 0.9, name: 'look_up' },
  { pattern: /find\s+(information|info|data|details)\s+(about|on|regarding)/i, weight: 0.9, name: 'find_info' },

  // Real-time/current information
  {
    pattern: /\b(latest|current|recent|today'?s?|now)\b.*\b(news|price|weather|update|version|status)/i,
    weight: 1.0,
    name: 'current_info'
  },
  { pattern: /what\s+(is|are)\s+the\s+(latest|current|newest)/i, weight: 0.95, name: 'what_latest' },
  { pattern: /\b(right\s+now|at\s+the\s+moment|currently)\b/i, weight: 0.7, name: 'temporal' },

  // News and events
  { pattern: /\bnews\b.*\b(about|on|regarding)\b/i, weight: 0.85, name: 'news_about' },
  { pattern: /what('?s|\s+is)\s+happening\b/i, weight: 0.8, name: 'happening' },
  { pattern: /\b(headline|breaking|trending)\b/i, weight: 0.85, name: 'headlines' },

  // Prices and markets
  { pattern: /\b(price|cost|rate)\s+of\b/i, weight: 0.7, name: 'price' },
  { pattern: /\b(stock|crypto|bitcoin|ethereum|btc|eth)\s+(price|value|market)/i, weight: 0.95, name: 'crypto_stock' },
  { pattern: /how\s+much\s+(does|is|are).*\b(cost|worth)\b/i, weight: 0.7, name: 'how_much' },

  // Weather
  { pattern: /\bweather\b.*\b(in|at|for|today|tomorrow|forecast)\b/i, weight: 0.95, name: 'weather' },

  // Documentation and APIs
  { pattern: /\bdocumentation\b.*\b(for|of|about)\b/i, weight: 0.6, name: 'documentation' },
  { pattern: /official\s+(website|docs|documentation|guide)/i, weight: 0.7, name: 'official_docs' },

  // Verification needs
  { pattern: /\b(verify|confirm|check|fact-check)\b.*\b(true|accurate|correct|real)\b/i, weight: 0.75, name: 'verify' },

  // Comparisons with external data
  { pattern: /\bcompare\b.*\b(prices|reviews|ratings|options)\b/i, weight: 0.65, name: 'compare' }
];

/**
 * Patterns that suggest code interpreter would be helpful.
 * Each pattern has an associated confidence weight.
 */
const CODE_INTERPRETER_PATTERNS: Array<{ pattern: RegExp; weight: number; name: string }> = [
  // Direct code requests
  { pattern: /write\s+(a\s+)?(function|code|script|program|algorithm)/i, weight: 0.95, name: 'write_code' },
  { pattern: /\b(code|implement|program)\s+(this|that|the|a)/i, weight: 0.85, name: 'code_this' },
  { pattern: /create\s+(a\s+)?(script|function|class|module)/i, weight: 0.9, name: 'create_script' },

  // Mathematical calculations
  { pattern: /\bcalculate\b.*\d+/i, weight: 0.9, name: 'calculate' },
  { pattern: /\b(compute|evaluate|solve)\b.*\b(equation|expression|formula|problem)\b/i, weight: 0.9, name: 'compute' },
  { pattern: /what\s+(is|are)\s+\d+[\s+\-*/^]+\d+/i, weight: 0.95, name: 'arithmetic' },
  { pattern: /\b(factorial|fibonacci|prime|sqrt|power|exponent)\b/i, weight: 0.85, name: 'math_functions' },

  // Data processing
  {
    pattern: /\b(parse|process|transform|convert)\s+(this\s+)?(data|json|csv|xml)/i,
    weight: 0.85,
    name: 'data_processing'
  },
  { pattern: /\b(analyze|process)\s+(this\s+)?(file|dataset|table)/i, weight: 0.8, name: 'analyze_data' },

  // Debugging
  { pattern: /\bdebug\b.*\b(this|my|the)\s+(code|function|script|program)/i, weight: 0.9, name: 'debug' },
  { pattern: /\b(fix|correct|repair)\s+(this|my|the)\s+(error|bug|issue|problem)\b/i, weight: 0.85, name: 'fix_error' },
  {
    pattern: /why\s+(is|does)\s+(this|my)\s+(code|function)\s+(not\s+work|fail|error)/i,
    weight: 0.9,
    name: 'why_not_work'
  },

  // Testing
  {
    pattern: /\b(test|verify|validate)\s+(this|my|the)\s+(code|function|implementation)/i,
    weight: 0.85,
    name: 'test_code'
  },
  { pattern: /\brun\s+(this|my|the)\s+(code|script|program)/i, weight: 0.95, name: 'run_code' },
  { pattern: /\bexecute\b.*\b(code|script|command)/i, weight: 0.95, name: 'execute' },

  // Code blocks in input (handles various markdown formats)
  { pattern: /```[\w]*[\s\S]*?```/, weight: 0.7, name: 'code_block' },

  // Algorithm requests
  { pattern: /\b(sort|search|traverse|optimize)\s+(algorithm|function|method)/i, weight: 0.85, name: 'algorithm' },

  // Regex
  { pattern: /\b(regex|regular\s+expression)\b/i, weight: 0.75, name: 'regex' },

  // File operations
  { pattern: /\b(read|write|create|delete)\s+(a\s+)?(file|directory|folder)/i, weight: 0.7, name: 'file_ops' }
];

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Automatically detect which tools should be enabled based on prompt content.
 *
 * @param prompt - The user's prompt text
 * @param config - Optional detection configuration
 * @returns Detection result with tool recommendations
 *
 * @example
 * ```ts
 * const result = detectToolsFromPrompt('What is the current price of Bitcoin?');
 * // result.webSearch === true
 * // result.webSearchConfidence === 0.95
 * ```
 */
export function detectToolsFromPrompt(prompt: string, config: AutoDetectConfig = {}): AutoDetectToolsResult {
  const { confidenceThreshold = 0.3, includePartialMatches = true } = config;

  const webSearchResult = detectPatterns(prompt, WEB_SEARCH_PATTERNS, includePartialMatches);
  const codeInterpreterResult = detectPatterns(prompt, CODE_INTERPRETER_PATTERNS, includePartialMatches);

  return {
    webSearch: webSearchResult.confidence >= confidenceThreshold,
    codeInterpreter: codeInterpreterResult.confidence >= confidenceThreshold,
    webSearchConfidence: webSearchResult.confidence,
    codeInterpreterConfidence: codeInterpreterResult.confidence,
    webSearchMatches: webSearchResult.matches,
    codeInterpreterMatches: codeInterpreterResult.matches
  };
}

/**
 * Simple version that just returns boolean flags.
 * Useful for quick checks without detailed confidence info.
 *
 * @param prompt - The user's prompt text
 * @returns Object with boolean flags for each tool
 */
export function shouldAutoEnableTools(prompt: string): {
  webSearch: boolean;
  codeInterpreter: boolean;
} {
  const result = detectToolsFromPrompt(prompt);
  return {
    webSearch: result.webSearch,
    codeInterpreter: result.codeInterpreter
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect patterns in text and calculate confidence.
 */
function detectPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; weight: number; name: string }>,
  includePartial: boolean
): { confidence: number; matches: string[] } {
  const matches: string[] = [];
  let maxWeight = 0;
  let matchCount = 0;

  for (const { pattern, weight, name } of patterns) {
    if (pattern.test(text)) {
      matches.push(name);
      maxWeight = Math.max(maxWeight, weight);
      matchCount++;
    }
  }

  // Calculate confidence based on matches
  // Use the max weight as the base, boosted by additional matches
  let confidence = 0;
  if (matchCount > 0) {
    if (includePartial) {
      // Boost confidence slightly for multiple matches (diminishing returns)
      const boost = Math.min(0.15, (matchCount - 1) * 0.05);
      confidence = Math.min(1.0, maxWeight + boost);
    } else {
      confidence = maxWeight;
    }
  }

  return { confidence, matches };
}

/**
 * Check if a prompt explicitly mentions not wanting tool usage.
 * Useful for respecting user preferences.
 */
export function hasToolOptOut(prompt: string): {
  webSearch: boolean;
  codeInterpreter: boolean;
} {
  const webSearchOptOut = /(don'?t|do\s+not|without|no)\s+(search(ing)?|web|internet|online)/i.test(prompt);
  // Match phrases like: "don't run", "without running code", "no code execution", etc.
  // Also match "or running code" type phrases after a "without" earlier in sentence
  const codeOptOut =
    /(don'?t|do\s+not|without|no)\s+(run(ning)?|execut(e|ing)|cod(e|ing))/i.test(prompt) ||
    /without\s+[\w\s]*running\s+code/i.test(prompt) ||
    /(or|and)\s+running\s+code/i.test(prompt);

  return {
    webSearch: webSearchOptOut,
    codeInterpreter: codeOptOut
  };
}
