import { describe, expect, it, vi } from 'vitest';
import { ProjectScaffolder, createEmptyScaffoldResult } from '../project-tools/scaffolder';

describe('Project Tools', () => {
  describe('ProjectScaffolder', () => {
    const createMockGenerator = (response: string) => vi.fn().mockResolvedValue({ text: response });

    it('scaffolds a project from JSON response', async () => {
      const jsonResponse = `
Here's your project:

\`\`\`json
{
  "projectName": "my-api",
  "projectType": "express",
  "technologies": ["Express.js", "TypeScript"],
  "files": [
    {
      "path": "package.json",
      "content": "{\\"name\\": \\"my-api\\"}",
      "description": "Package manifest"
    },
    {
      "path": "src/index.ts",
      "content": "import express from 'express';",
      "description": "Entry point"
    }
  ],
  "setupCommands": ["npm install", "npm run dev"],
  "estimatedSetupTime": "5 minutes"
}
\`\`\`
      `;

      const scaffolder = new ProjectScaffolder({
        generateText: createMockGenerator(jsonResponse)
      });

      const result = await scaffolder.scaffold('A REST API for todos', {
        type: 'express'
      });

      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe('package.json');
      expect(result.metadata.projectName).toBe('my-api');
      expect(result.metadata.projectType).toBe('express');
      expect(result.setupCommands).toContain('npm install');
    });

    it('extracts files from code blocks when JSON parsing fails', async () => {
      const codeBlockResponse = `
Here are your files:

\`\`\`package.json
{
  "name": "test-project"
}
\`\`\`

\`\`\`src/index.ts
console.log("Hello");
\`\`\`
      `;

      const scaffolder = new ProjectScaffolder({
        generateText: createMockGenerator(codeBlockResponse)
      });

      const result = await scaffolder.scaffold('A simple project', {
        type: 'node'
      });

      expect(result.files.length).toBeGreaterThan(0);
    });

    it('includes configuration options in prompt', async () => {
      let capturedPrompt = '';
      const scaffolder = new ProjectScaffolder({
        generateText: vi.fn().mockImplementation(async (prompt: string) => {
          capturedPrompt = prompt;
          return { text: '{"files": [], "projectName": "test"}' };
        })
      });

      await scaffolder.scaffold('A project', {
        type: 'nextjs',
        includeTests: true,
        includeCI: true,
        includeDocker: true,
        includeDocs: true,
        includeLinting: true,
        useTypeScript: true
      });

      expect(capturedPrompt).toContain('nextjs');
      expect(capturedPrompt).toContain('test files');
      expect(capturedPrompt).toContain('GitHub Actions');
      expect(capturedPrompt).toContain('Dockerfile');
      expect(capturedPrompt).toContain('README');
      expect(capturedPrompt).toContain('ESLint');
      expect(capturedPrompt).toContain('TypeScript');
    });

    it('generates instructions', async () => {
      const scaffolder = new ProjectScaffolder({
        generateText: createMockGenerator(`{
          "projectName": "my-project",
          "projectType": "node",
          "files": [{"path": "index.js", "content": "// code"}],
          "setupCommands": ["npm install"],
          "estimatedSetupTime": "2 minutes"
        }`)
      });

      const result = await scaffolder.scaffold('A project', {});

      expect(result.instructions).toContain('Quick Start');
      expect(result.instructions).toContain('my-project');
      expect(result.instructions).toContain('npm install');
    });

    it('handles custom template', async () => {
      let capturedPrompt = '';
      const scaffolder = new ProjectScaffolder({
        generateText: vi.fn().mockImplementation(async (prompt: string) => {
          capturedPrompt = prompt;
          return { text: '{"files": []}' };
        })
      });

      await scaffolder.scaffold('A project', {
        customTemplate: 'Must use Redux and React Query'
      });

      expect(capturedPrompt).toContain('Redux');
      expect(capturedPrompt).toContain('React Query');
    });

    it('detects project type from files', async () => {
      const scaffolder = new ProjectScaffolder({
        generateText: createMockGenerator(`{
          "files": [
            {"path": "package.json", "content": "{\\"dependencies\\": {\\"react\\": \\"^18.0.0\\"}}"},
            {"path": "src/App.tsx", "content": "export const App = () => <div>Hello</div>"}
          ]
        }`)
      });

      const result = await scaffolder.scaffold('A project', { type: 'auto' });

      expect(result.metadata.projectType).toBe('react');
    });

    it('returns empty files for instructions-only format', async () => {
      const scaffolder = new ProjectScaffolder({
        generateText: createMockGenerator(`{
          "projectName": "test",
          "files": [{"path": "index.js", "content": "code"}]
        }`)
      });

      const result = await scaffolder.scaffold('A project', {
        outputFormat: 'instructions'
      });

      expect(result.files).toHaveLength(0);
      expect(result.instructions).toBeTruthy();
    });
  });

  describe('createEmptyScaffoldResult', () => {
    it('creates empty result with error message', () => {
      const result = createEmptyScaffoldResult('Failed to generate project');

      expect(result.files).toHaveLength(0);
      expect(result.instructions).toContain('Failed to generate project');
      expect(result.setupCommands).toHaveLength(0);
      expect(result.metadata.fileCount).toBe(0);
    });
  });
});
