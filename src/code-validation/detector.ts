/**
 * Language detection and code extraction utilities.
 * @module
 */

import type { CodeBlock, CodeExtractionResult, LanguageDetectionResult, SupportedLanguage } from './types';

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Language detection patterns with confidence weights.
 */
const LANGUAGE_PATTERNS: Array<{
  language: SupportedLanguage;
  patterns: Array<{ pattern: RegExp; weight: number; name: string }>;
}> = [
  {
    language: 'typescript',
    patterns: [
      { pattern: /:\s*(string|number|boolean|void|any|unknown|never)\b/, weight: 0.9, name: 'type_annotation' },
      { pattern: /interface\s+\w+\s*{/, weight: 0.95, name: 'interface' },
      { pattern: /type\s+\w+\s*=/, weight: 0.9, name: 'type_alias' },
      { pattern: /<\w+>/, weight: 0.5, name: 'generics' },
      { pattern: /import\s+.*\s+from\s+['"]/, weight: 0.7, name: 'import_from' },
      { pattern: /export\s+(interface|type|enum)\b/, weight: 0.95, name: 'export_type' },
      { pattern: /as\s+(string|number|boolean|any)\b/, weight: 0.85, name: 'type_assertion' }
    ]
  },
  {
    language: 'javascript',
    patterns: [
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 0.6, name: 'function_decl' },
      { pattern: /\bconst\s+\w+\s*=/, weight: 0.5, name: 'const' },
      { pattern: /\blet\s+\w+\s*=/, weight: 0.5, name: 'let' },
      { pattern: /=>\s*{/, weight: 0.6, name: 'arrow_function' },
      { pattern: /require\s*\(['"]/, weight: 0.7, name: 'require' },
      { pattern: /module\.exports\s*=/, weight: 0.85, name: 'module_exports' },
      { pattern: /console\.(log|error|warn)\(/, weight: 0.5, name: 'console' }
    ]
  },
  {
    language: 'python',
    patterns: [
      { pattern: /\bdef\s+\w+\s*\([^)]*\)\s*:/, weight: 0.9, name: 'def' },
      { pattern: /\bclass\s+\w+.*:/, weight: 0.85, name: 'class' },
      { pattern: /\bimport\s+\w+/, weight: 0.6, name: 'import' },
      { pattern: /\bfrom\s+\w+\s+import\b/, weight: 0.85, name: 'from_import' },
      { pattern: /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/, weight: 0.95, name: 'main_guard' },
      { pattern: /\bprint\s*\(/, weight: 0.5, name: 'print' },
      { pattern: /\bself\.\w+/, weight: 0.85, name: 'self' },
      { pattern: /#.*$/, weight: 0.3, name: 'comment' }
    ]
  },
  {
    language: 'java',
    patterns: [
      { pattern: /public\s+class\s+\w+/, weight: 0.95, name: 'public_class' },
      { pattern: /public\s+static\s+void\s+main/, weight: 0.98, name: 'main_method' },
      { pattern: /System\.out\.println/, weight: 0.9, name: 'sysout' },
      { pattern: /\bpackage\s+[\w.]+;/, weight: 0.95, name: 'package' },
      { pattern: /\bimport\s+[\w.]+;/, weight: 0.8, name: 'import' },
      { pattern: /@Override\b/, weight: 0.9, name: 'override' },
      { pattern: /\bprivate\s+\w+\s+\w+;/, weight: 0.7, name: 'private_field' }
    ]
  },
  {
    language: 'go',
    patterns: [
      { pattern: /\bpackage\s+main\b/, weight: 0.95, name: 'package_main' },
      { pattern: /\bfunc\s+\w+\s*\(/, weight: 0.85, name: 'func' },
      { pattern: /\bfmt\.Print/, weight: 0.9, name: 'fmt_print' },
      { pattern: /\bimport\s+\(/, weight: 0.85, name: 'import_block' },
      { pattern: /:=/, weight: 0.7, name: 'short_var_decl' },
      { pattern: /\bgo\s+\w+\(/, weight: 0.9, name: 'goroutine' },
      { pattern: /\bchan\s+\w+/, weight: 0.9, name: 'channel' }
    ]
  },
  {
    language: 'rust',
    patterns: [
      { pattern: /\bfn\s+\w+\s*\(/, weight: 0.9, name: 'fn' },
      { pattern: /\blet\s+mut\s+\w+/, weight: 0.95, name: 'let_mut' },
      { pattern: /\bimpl\s+\w+\s+for\s+\w+/, weight: 0.95, name: 'impl_for' },
      { pattern: /\buse\s+[\w:]+;/, weight: 0.85, name: 'use' },
      { pattern: /\bpub\s+(fn|struct|enum|mod)\b/, weight: 0.9, name: 'pub' },
      { pattern: /->.*{/, weight: 0.7, name: 'return_type' },
      { pattern: /\bprintln!\(/, weight: 0.95, name: 'println_macro' }
    ]
  },
  {
    language: 'ruby',
    patterns: [
      { pattern: /\bdef\s+\w+/, weight: 0.8, name: 'def' },
      { pattern: /\bclass\s+\w+/, weight: 0.7, name: 'class' },
      { pattern: /\bend\s*$/, weight: 0.4, name: 'end' },
      { pattern: /\brequire\s+['"]/, weight: 0.85, name: 'require' },
      { pattern: /\bputs\s+/, weight: 0.8, name: 'puts' },
      { pattern: /@\w+/, weight: 0.5, name: 'instance_var' },
      { pattern: /\.each\s+do\s*\|/, weight: 0.85, name: 'each_block' }
    ]
  },
  {
    language: 'php',
    patterns: [
      { pattern: /<\?php/, weight: 0.98, name: 'php_tag' },
      { pattern: /\$\w+\s*=/, weight: 0.75, name: 'php_var' },
      { pattern: /\bfunction\s+\w+\s*\(/, weight: 0.5, name: 'function' },
      { pattern: /\becho\s+/, weight: 0.7, name: 'echo' },
      { pattern: /->(\w+)\(/, weight: 0.6, name: 'method_call' },
      { pattern: /\buse\s+[\w\\]+;/, weight: 0.8, name: 'use' }
    ]
  },
  {
    language: 'cpp',
    patterns: [
      { pattern: /#include\s*<[\w.]+>/, weight: 0.9, name: 'include_angle' },
      { pattern: /#include\s*"[\w.]+"/, weight: 0.85, name: 'include_quote' },
      { pattern: /\bstd::\w+/, weight: 0.9, name: 'std_namespace' },
      { pattern: /\bint\s+main\s*\(/, weight: 0.95, name: 'main' },
      { pattern: /\bcout\s*<</, weight: 0.95, name: 'cout' },
      { pattern: /\bnamespace\s+\w+/, weight: 0.85, name: 'namespace' },
      { pattern: /\btemplate\s*</, weight: 0.9, name: 'template' }
    ]
  }
];

/**
 * Detect the programming language of a code snippet.
 *
 * @param code - The code to analyze
 * @returns Detection result with language, confidence, and indicators
 */
export function detectLanguage(code: string): LanguageDetectionResult {
  const scores: Map<SupportedLanguage, { score: number; indicators: string[] }> = new Map();

  // Initialize scores
  for (const { language } of LANGUAGE_PATTERNS) {
    scores.set(language, { score: 0, indicators: [] });
  }

  // Check each language's patterns
  for (const { language, patterns } of LANGUAGE_PATTERNS) {
    const langScore = scores.get(language)!;

    for (const { pattern, weight, name } of patterns) {
      if (pattern.test(code)) {
        langScore.score += weight;
        langScore.indicators.push(name);
      }
    }
  }

  // Find the best match
  let bestLanguage: SupportedLanguage = 'javascript'; // default
  let bestScore = 0;
  let bestIndicators: string[] = [];

  for (const [language, { score, indicators }] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
      bestIndicators = indicators;
    }
  }

  // Handle TypeScript vs JavaScript ambiguity
  const tsScore = scores.get('typescript')!.score;
  const jsScore = scores.get('javascript')!.score;

  // If both have similar scores but TS has type-specific indicators, prefer TS
  if (
    tsScore > 0 &&
    jsScore > 0 &&
    Math.abs(tsScore - jsScore) < 0.5 &&
    scores
      .get('typescript')!
      .indicators.some((i) => ['type_annotation', 'interface', 'type_alias', 'export_type'].includes(i))
  ) {
    bestLanguage = 'typescript';
    bestScore = tsScore;
    bestIndicators = scores.get('typescript')!.indicators;
  }

  // Calculate confidence (normalize score)
  const maxPossibleScore =
    LANGUAGE_PATTERNS.find((l) => l.language === bestLanguage)?.patterns.reduce((sum, p) => sum + p.weight, 0) ?? 1;

  const confidence = Math.min(1, bestScore / Math.max(1, maxPossibleScore * 0.5));

  return {
    language: bestLanguage,
    confidence,
    indicators: bestIndicators
  };
}

// ============================================================================
// Code Extraction
// ============================================================================

/**
 * Extract code blocks from text (including markdown code fences).
 *
 * @param text - Text that may contain code blocks
 * @returns Extraction result with code blocks
 */
export function extractCodeBlocks(text: string): CodeExtractionResult {
  const blocks: CodeBlock[] = [];

  // Match markdown code fences
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = fenceRegex.exec(text);

  while (match !== null) {
    blocks.push({
      code: match[2].trim(),
      language: match[1] || undefined,
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
    match = fenceRegex.exec(text);
  }

  // If no fenced blocks, check for inline code or treat entire text as code
  if (blocks.length === 0) {
    // Check if text looks like code (has significant code patterns)
    const { confidence } = detectLanguage(text);
    if (confidence > 0.3) {
      blocks.push({
        code: text.trim(),
        startIndex: 0,
        endIndex: text.length
      });
    }
  }

  return {
    blocks,
    hasCode: blocks.length > 0
  };
}

/**
 * Extract the primary code block from text.
 * Returns the largest/most significant code block.
 *
 * @param text - Text that may contain code blocks
 * @returns The primary code or undefined if no code found
 */
export function extractPrimaryCode(text: string): string | undefined {
  const { blocks, hasCode } = extractCodeBlocks(text);

  if (!hasCode) {
    return undefined;
  }

  // Return the largest block
  return blocks.reduce((largest, block) => (block.code.length > largest.code.length ? block : largest)).code;
}

/**
 * Check if text contains code.
 *
 * @param text - Text to check
 * @returns True if text contains code
 */
export function containsCode(text: string): boolean {
  // Check for code fences
  if (/```[\s\S]*```/.test(text)) {
    return true;
  }

  // Check for common code patterns directly (quick check before full language detection)
  const quickCodePatterns = [
    /\bfunction\s+\w+\s*\([^)]*\)\s*\{/, // function declarations
    /\bconst\s+\w+\s*=\s*\([^)]*\)\s*=>/, // arrow functions
    /\bclass\s+\w+\s*(\s+extends\s+\w+)?\s*\{/, // class declarations
    /\bdef\s+\w+\s*\([^)]*\)\s*:/, // Python functions
    /\bimport\s+.*\s+from\s+['"]/, // ES imports
    /\b(if|for|while)\s*\([^)]*\)\s*\{/, // Control structures with braces
    /=>\s*\{[\s\S]*\}/, // Arrow function bodies
    /\breturn\s+[\w"'`{[<]/ // Return statements
  ];

  for (const pattern of quickCodePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Check for code-like patterns via language detection
  const { confidence } = detectLanguage(text);
  return confidence > 0.4;
}

/**
 * Get file extension for a language.
 *
 * @param language - The programming language
 * @returns File extension (without dot)
 */
export function getFileExtension(language: SupportedLanguage): string {
  const extensions: Record<SupportedLanguage, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    go: 'go',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    auto: 'txt'
  };

  return extensions[language] || 'txt';
}
