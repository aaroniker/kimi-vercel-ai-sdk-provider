/**
 * Types for project scaffolding functionality.
 * @module
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Supported project types/frameworks.
 */
export type ProjectType =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'node'
  | 'express'
  | 'fastify'
  | 'python'
  | 'fastapi'
  | 'flask'
  | 'go'
  | 'rust'
  | 'auto';

/**
 * Output format for scaffolded projects.
 */
export type OutputFormat = 'files' | 'json' | 'instructions';

/**
 * Configuration for project scaffolding.
 */
export interface ScaffoldConfig {
  /**
   * Project type/framework.
   * @default 'auto'
   */
  type?: ProjectType;

  /**
   * Include testing setup.
   * @default true
   */
  includeTests?: boolean;

  /**
   * Include CI/CD configuration (e.g., GitHub Actions).
   * @default false
   */
  includeCI?: boolean;

  /**
   * Include documentation (README, API docs).
   * @default true
   */
  includeDocs?: boolean;

  /**
   * Include Docker configuration.
   * @default false
   */
  includeDocker?: boolean;

  /**
   * Include ESLint/Prettier configuration.
   * @default true
   */
  includeLinting?: boolean;

  /**
   * Output format.
   * @default 'files'
   */
  outputFormat?: OutputFormat;

  /**
   * TypeScript vs JavaScript (for applicable frameworks).
   * @default true
   */
  useTypeScript?: boolean;

  /**
   * Additional features to include.
   */
  features?: string[];

  /**
   * Custom template or instructions to include.
   */
  customTemplate?: string;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * A single file in the scaffolded project.
 */
export interface ProjectFile {
  /**
   * Relative path from project root.
   */
  path: string;

  /**
   * File contents.
   */
  content: string;

  /**
   * Description of the file's purpose.
   */
  description?: string;

  /**
   * Whether this is a binary file (base64 encoded).
   */
  binary?: boolean;
}

/**
 * Metadata about the scaffolded project.
 */
export interface ProjectMetadata {
  /**
   * Detected or specified project type.
   */
  projectType: ProjectType;

  /**
   * Project name (derived from description).
   */
  projectName: string;

  /**
   * Number of files generated.
   */
  fileCount: number;

  /**
   * Total size of all files (bytes).
   */
  totalSize: number;

  /**
   * Estimated setup time.
   */
  estimatedSetupTime: string;

  /**
   * Main technologies/dependencies used.
   */
  technologies: string[];

  /**
   * Features included in the project.
   */
  features: string[];
}

/**
 * Result of scaffolding a project.
 */
export interface ScaffoldResult {
  /**
   * Generated project files.
   */
  files: ProjectFile[];

  /**
   * Setup instructions for the user.
   */
  instructions: string;

  /**
   * Commands to run for setup.
   */
  setupCommands: string[];

  /**
   * Project metadata.
   */
  metadata: ProjectMetadata;

  /**
   * Raw response from the model (for debugging).
   */
  rawResponse?: string;
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * A project template definition.
 */
export interface ProjectTemplate {
  /**
   * Template identifier.
   */
  id: string;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Template description.
   */
  description: string;

  /**
   * Project type this template is for.
   */
  projectType: ProjectType;

  /**
   * Base files that are always included.
   */
  baseFiles: ProjectFile[];

  /**
   * Optional files based on configuration.
   */
  optionalFiles?: {
    condition: keyof ScaffoldConfig;
    files: ProjectFile[];
  }[];

  /**
   * Default setup commands.
   */
  setupCommands: string[];

  /**
   * Technologies used.
   */
  technologies: string[];
}
