/**
 * Project scaffolder implementation.
 * @module
 */

import type { OutputFormat, ProjectFile, ProjectMetadata, ProjectType, ScaffoldConfig, ScaffoldResult } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Function type for generating text.
 */
export type GenerateTextFunction = (prompt: string) => Promise<{ text: string }>;

/**
 * Options for creating a scaffolder.
 */
export interface ScaffolderOptions {
  /**
   * Function to generate text from the model.
   */
  generateText: GenerateTextFunction;

  /**
   * Default model ID to use.
   */
  modelId?: string;
}

// ============================================================================
// ProjectScaffolder Class
// ============================================================================

/**
 * Scaffolder for generating project structures.
 *
 * @example
 * ```ts
 * const scaffolder = new ProjectScaffolder({
 *   generateText: async (prompt) => {
 *     const result = await generateText({ model, prompt });
 *     return { text: result.text };
 *   },
 * });
 *
 * const project = await scaffolder.scaffold(
 *   'A REST API for todo management',
 *   { type: 'express', includeTests: true }
 * );
 * ```
 */
export class ProjectScaffolder {
  private generateText: GenerateTextFunction;

  constructor(options: ScaffolderOptions) {
    this.generateText = options.generateText;
  }

  /**
   * Scaffold a new project based on a description.
   *
   * @param description - Description of the project to create
   * @param config - Scaffold configuration
   * @returns Scaffold result with files and instructions
   */
  async scaffold(description: string, config: ScaffoldConfig = {}): Promise<ScaffoldResult> {
    const {
      type = 'auto',
      includeTests = true,
      includeCI = false,
      includeDocs = true,
      includeDocker = false,
      includeLinting = true,
      outputFormat = 'files',
      useTypeScript = true,
      features = [],
      customTemplate
    } = config;

    // Build the prompt for project generation
    const prompt = this.buildScaffoldPrompt(description, {
      type,
      includeTests,
      includeCI,
      includeDocs,
      includeDocker,
      includeLinting,
      useTypeScript,
      features,
      customTemplate
    });

    // Generate the project structure
    const result = await this.generateText(prompt);

    // Parse the response
    const parsed = this.parseResponse(result.text, type);

    // Format output based on config
    return this.formatResult(parsed, outputFormat, result.text);
  }

  /**
   * Build the scaffold prompt.
   */
  private buildScaffoldPrompt(
    description: string,
    config: {
      type: ProjectType;
      includeTests: boolean;
      includeCI: boolean;
      includeDocs: boolean;
      includeDocker: boolean;
      includeLinting: boolean;
      useTypeScript: boolean;
      features: string[];
      customTemplate?: string;
    }
  ): string {
    const parts: string[] = [];

    parts.push('Generate a complete project structure for the following description:');
    parts.push(`"${description}"`);
    parts.push('');

    if (config.type !== 'auto') {
      parts.push(`Framework/Type: ${config.type}`);
    }

    parts.push(`Language: ${config.useTypeScript ? 'TypeScript' : 'JavaScript/Python/Go (as appropriate)'}`);

    const includes: string[] = [];
    if (config.includeTests) {
      includes.push('comprehensive test files');
    }
    if (config.includeCI) {
      includes.push('GitHub Actions CI/CD workflow');
    }
    if (config.includeDocs) {
      includes.push('README with setup instructions');
    }
    if (config.includeDocker) {
      includes.push('Dockerfile and docker-compose.yml');
    }
    if (config.includeLinting) {
      includes.push('ESLint/linting configuration');
    }

    if (includes.length > 0) {
      parts.push(`Include: ${includes.join(', ')}`);
    }

    if (config.features.length > 0) {
      parts.push(`Additional features: ${config.features.join(', ')}`);
    }

    if (config.customTemplate) {
      parts.push('');
      parts.push('Custom requirements:');
      parts.push(config.customTemplate);
    }

    parts.push('');
    parts.push('Respond with a JSON object in this exact format:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "projectName": "project-name",');
    parts.push('  "projectType": "detected-type",');
    parts.push('  "technologies": ["tech1", "tech2"],');
    parts.push('  "files": [');
    parts.push('    {');
    parts.push('      "path": "relative/path/to/file.ts",');
    parts.push('      "content": "full file content here",');
    parts.push('      "description": "what this file does"');
    parts.push('    }');
    parts.push('  ],');
    parts.push('  "setupCommands": ["npm install", "npm run dev"],');
    parts.push('  "estimatedSetupTime": "5 minutes"');
    parts.push('}');
    parts.push('```');
    parts.push('');
    parts.push(
      'Include ALL necessary files for a working project: package.json/requirements.txt, source files, config files, etc.'
    );
    parts.push('Make sure file contents are complete and functional, not placeholders.');

    return parts.join('\n');
  }

  /**
   * Parse the model response into structured data.
   */
  private parseResponse(
    text: string,
    defaultType: ProjectType
  ): {
    files: ProjectFile[];
    metadata: ProjectMetadata;
    setupCommands: string[];
  } {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) || text.match(/\{[\s\S]*"files"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const files: ProjectFile[] = (json.files || []).map((f: ProjectFile) => {
          return {
            path: f.path,
            content: f.content,
            description: f.description
          };
        });

        // If projectType is explicitly provided in JSON, use it
        // If defaultType is 'auto', try to detect from files
        // Otherwise use the defaultType
        let projectType: ProjectType;
        if (json.projectType) {
          projectType = json.projectType as ProjectType;
        } else if (defaultType === 'auto') {
          projectType = this.detectProjectType(files);
        } else {
          projectType = defaultType;
        }

        return {
          files,
          metadata: {
            projectType,
            projectName: json.projectName || 'my-project',
            fileCount: files.length,
            totalSize: files.reduce((sum: number, f: ProjectFile) => sum + (f.content?.length || 0), 0),
            estimatedSetupTime: json.estimatedSetupTime || 'unknown',
            technologies: json.technologies || [],
            features: []
          },
          setupCommands: json.setupCommands || []
        };
      } catch {
        // JSON parsing failed, try fallback
      }
    }

    // Fallback: extract files from code blocks
    return this.parseFromCodeBlocks(text, defaultType);
  }

  /**
   * Parse files from markdown code blocks.
   */
  private parseFromCodeBlocks(
    text: string,
    defaultType: ProjectType
  ): {
    files: ProjectFile[];
    metadata: ProjectMetadata;
    setupCommands: string[];
  } {
    const files: ProjectFile[] = [];

    // Match code blocks with file paths in the language annotation
    // e.g., ```typescript:src/index.ts or ```path/to/file.ts
    const fileBlockRegex = /```(?:(\w+):)?([\w./-]+)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null = fileBlockRegex.exec(text);

    while (match !== null) {
      const path = match[2];
      const content = match[3].trim();

      // Skip if path doesn't look like a file
      if (path.includes('.')) {
        files.push({
          path,
          content,
          description: undefined
        });
      }
      match = fileBlockRegex.exec(text);
    }

    // If no files found with paths, try generic code blocks
    if (files.length === 0) {
      const genericBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let blockMatch: RegExpExecArray | null = genericBlockRegex.exec(text);
      let index = 0;

      while (blockMatch !== null) {
        const lang = blockMatch[1] || 'txt';
        const content = blockMatch[2].trim();

        if (content.length > 10) {
          // Skip trivial blocks
          const ext = this.getExtensionForLanguage(lang);
          files.push({
            path: `file${index}.${ext}`,
            content
          });
          index++;
        }
        blockMatch = genericBlockRegex.exec(text);
      }
    }

    return {
      files,
      metadata: {
        projectType: defaultType === 'auto' ? this.detectProjectType(files) : defaultType,
        projectName: 'my-project',
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.content.length, 0),
        estimatedSetupTime: 'unknown',
        technologies: [],
        features: []
      },
      setupCommands: []
    };
  }

  /**
   * Detect project type from files.
   */
  private detectProjectType(files: ProjectFile[]): ProjectType {
    const paths = files.map((f) => f.path.toLowerCase());
    const contents = files.map((f) => f.content);

    if (paths.some((p) => p.includes('next.config'))) {
      return 'nextjs';
    }
    if (contents.some((c) => c.includes('from fastapi'))) {
      return 'fastapi';
    }
    if (contents.some((c) => c.includes('from flask'))) {
      return 'flask';
    }
    if (paths.some((p) => p.includes('package.json'))) {
      const pkgFile = files.find((f) => f.path.includes('package.json'));
      if (pkgFile) {
        if (pkgFile.content.includes('"react"')) {
          return 'react';
        }
        if (pkgFile.content.includes('"vue"')) {
          return 'vue';
        }
        if (pkgFile.content.includes('"express"')) {
          return 'express';
        }
        if (pkgFile.content.includes('"fastify"')) {
          return 'fastify';
        }
      }
      return 'node';
    }
    if (paths.some((p) => p.includes('requirements.txt') || p.endsWith('.py'))) {
      return 'python';
    }
    if (paths.some((p) => p.includes('go.mod') || p.endsWith('.go'))) {
      return 'go';
    }
    if (paths.some((p) => p.includes('cargo.toml') || p.endsWith('.rs'))) {
      return 'rust';
    }

    return 'node';
  }

  /**
   * Get file extension for a language.
   */
  private getExtensionForLanguage(lang: string): string {
    const map: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      go: 'go',
      rust: 'rs',
      json: 'json',
      yaml: 'yml',
      markdown: 'md',
      html: 'html',
      css: 'css',
      shell: 'sh',
      bash: 'sh',
      dockerfile: 'dockerfile',
      sql: 'sql'
    };

    return map[lang.toLowerCase()] || 'txt';
  }

  /**
   * Format the result based on output format.
   */
  private formatResult(
    parsed: {
      files: ProjectFile[];
      metadata: ProjectMetadata;
      setupCommands: string[];
    },
    format: OutputFormat,
    rawResponse: string
  ): ScaffoldResult {
    const instructions = this.generateInstructions(parsed);

    return {
      files: format === 'instructions' ? [] : parsed.files,
      instructions,
      setupCommands: parsed.setupCommands,
      metadata: parsed.metadata,
      rawResponse: format === 'json' ? rawResponse : undefined
    };
  }

  /**
   * Generate setup instructions.
   */
  private generateInstructions(parsed: {
    files: ProjectFile[];
    metadata: ProjectMetadata;
    setupCommands: string[];
  }): string {
    const lines: string[] = [];

    lines.push(`# ${parsed.metadata.projectName} Setup`);
    lines.push('');
    lines.push(`Project type: ${parsed.metadata.projectType}`);
    lines.push(`Files: ${parsed.metadata.fileCount}`);
    lines.push('');

    if (parsed.metadata.technologies.length > 0) {
      lines.push('## Technologies');
      lines.push(parsed.metadata.technologies.map((t) => `- ${t}`).join('\n'));
      lines.push('');
    }

    lines.push('## Quick Start');
    lines.push('');
    lines.push('1. Create project directory:');
    lines.push('```bash');
    lines.push(`mkdir ${parsed.metadata.projectName}`);
    lines.push(`cd ${parsed.metadata.projectName}`);
    lines.push('```');
    lines.push('');

    lines.push('2. Create the following files:');
    for (const file of parsed.files.slice(0, 10)) {
      lines.push(`   - \`${file.path}\`${file.description ? `: ${file.description}` : ''}`);
    }
    if (parsed.files.length > 10) {
      lines.push(`   - ... and ${parsed.files.length - 10} more files`);
    }
    lines.push('');

    if (parsed.setupCommands.length > 0) {
      lines.push('3. Run setup commands:');
      lines.push('```bash');
      lines.push(parsed.setupCommands.join('\n'));
      lines.push('```');
      lines.push('');
    }

    if (parsed.metadata.estimatedSetupTime !== 'unknown') {
      lines.push(`Estimated setup time: ${parsed.metadata.estimatedSetupTime}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an empty scaffold result.
 */
export function createEmptyScaffoldResult(error: string): ScaffoldResult {
  return {
    files: [],
    instructions: `Error: ${error}`,
    setupCommands: [],
    metadata: {
      projectType: 'auto',
      projectName: 'unknown',
      fileCount: 0,
      totalSize: 0,
      estimatedSetupTime: 'unknown',
      technologies: [],
      features: []
    }
  };
}
