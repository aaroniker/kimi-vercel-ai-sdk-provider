/**
 * Tools module exports.
 * @module
 */

export type { AutoDetectConfig, AutoDetectToolsResult } from './auto-detect';
export type {
  KimiBuiltinTool,
  KimiCodeInterpreterConfig,
  KimiCodeInterpreterToolOptions,
  KimiWebSearchConfig,
  KimiWebSearchToolConfig,
  KimiWebSearchToolOptions
} from './builtin-tools';
export type {
  KimiFunctionTool,
  KimiTool,
  PrepareToolsOptions,
  PrepareToolsResult,
  ToolGuidanceOptions
} from './prepare-tools';
// Auto-detection
export { detectToolsFromPrompt, hasToolOptOut, shouldAutoEnableTools } from './auto-detect';
// Built-in tools
export {
  KIMI_CODE_INTERPRETER_TOOL_NAME,
  KIMI_WEB_SEARCH_TOOL_NAME,
  createCodeInterpreterTool,
  createKimiWebSearchTool,
  createWebSearchTool,
  isBuiltinToolName,
  isCodeInterpreterTool,
  isWebSearchTool,
  kimiTools
} from './builtin-tools';
// Tool preparation
export { generateToolGuidanceMessage, prepareKimiTools } from './prepare-tools';
