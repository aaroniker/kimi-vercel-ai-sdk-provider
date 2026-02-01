/**
 * Project tools module exports.
 * @module
 */

export type { GenerateTextFunction, ScaffolderOptions } from './scaffolder';
export type {
  OutputFormat,
  ProjectFile,
  ProjectMetadata,
  ProjectTemplate,
  ProjectType,
  ScaffoldConfig,
  ScaffoldResult
} from './types';
export { ProjectScaffolder, createEmptyScaffoldResult } from './scaffolder';
