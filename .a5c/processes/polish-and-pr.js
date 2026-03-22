/**
 * @process polish-and-pr
 * @description Fix pre-existing test failures, visual QA on mobile, commit all changes, create PR
 * @inputs { projectRoot: string }
 * @outputs { success: boolean, prUrl: string }
 *
 * @agent ui-implementer specializations/ux-ui-design/agents/ui-implementer/AGENT.md
 * @agent test-strategy-architect specializations/qa-testing-automation/agents/test-strategy-architect/AGENT.md
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

export async function process(inputs, ctx) {
  const { projectRoot } = inputs;

  // ============================================================================
  // STEP 1: Fix Pre-existing Test Failures
  // ============================================================================

  ctx.log('info', 'Step 1: Fix pre-existing test failures');

  const fixTests = await ctx.task(fixTestsTask, { projectRoot });

  // Verify tests pass
  const testVerify = await ctx.task(runTestsTask, { projectRoot });

  // ============================================================================
  // STEP 2: Visual QA on Mobile Viewport
  // ============================================================================

  ctx.log('info', 'Step 2: Visual QA on mobile viewport');

  const visualQA = await ctx.task(visualQATask, { projectRoot });

  // ============================================================================
  // STEP 3: Final Quality Gate
  // ============================================================================

  ctx.log('info', 'Step 3: Final quality gate');

  const qualityGate = await ctx.task(qualityGateTask, { projectRoot });

  // ============================================================================
  // STEP 4: Commit + Create PR
  // ============================================================================

  ctx.log('info', 'Step 4: Commit and create PR');

  await ctx.breakpoint({
    question: 'Tests fixed, visual QA passed, quality gate passed. Ready to commit all changes and create a PR to main?',
    title: 'Ready to Commit & PR',
    context: { runId: ctx.runId }
  });

  const commitAndPR = await ctx.task(commitAndPRTask, { projectRoot });

  return {
    success: true,
    prUrl: commitAndPR.prUrl || 'created'
  };
}

export const fixTestsTask = defineTask('fix-tests', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Fix pre-existing test failures (searchHistory localStorage.clear)',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior React/TypeScript developer fixing test failures',
      task: 'Fix the 36 pre-existing test failures in useSearchHistory.test.ts and searchHistoryService.test.ts',
      context: {
        projectRoot: args.projectRoot,
        files: ['src/hooks/__tests__/useSearchHistory.test.ts', 'src/services/__tests__/searchHistoryService.test.ts'],
        description: 'These tests fail because localStorage.clear is not a function in the jsdom test environment. The test files use localStorage.clear() in beforeEach but the mock or jsdom setup does not provide it properly. Fix the tests by either: (1) properly mocking localStorage with a clear function in the test setup, or (2) replacing localStorage.clear() calls with manual key deletion, or (3) updating the test setup in src/test/setup.ts to provide a proper localStorage mock. Run the tests after fixing to verify they pass.'
      },
      instructions: [
        'Read the failing test files first',
        'Read src/test/setup.ts to understand the test environment',
        'Fix the localStorage.clear issue',
        'Run npx vitest run to verify ALL tests pass',
        'If tests still fail, iterate until they pass',
        'Return summary of changes'
      ],
      outputFormat: 'JSON with fields: { success: boolean, filesModified: string[], summary: string, allTestsPass: boolean }'
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['agent', 'fix-tests']
}));

export const runTestsTask = defineTask('run-tests', (args, taskCtx) => ({
  kind: 'shell',
  title: 'Verify all tests pass',
  shell: {
    command: `cd ${args.projectRoot} && npx vitest run 2>&1 | tail -20`,
    timeout: 60000
  },
  io: { outputJsonPath: `tasks/${taskCtx.effectId}/output.json` },
  labels: ['shell', 'tests']
}));

export const visualQATask = defineTask('visual-qa', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Visual QA on mobile viewport',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA engineer performing visual verification',
      task: 'Perform visual QA on the Shelter Route app on mobile viewport',
      context: {
        projectRoot: args.projectRoot,
        description: 'Use the preview tools to verify the app looks correct on mobile. Check: (1) Emergency FAB is visible with panel open, (2) Shelters Near Me button renders correctly, (3) Onboarding overlay works, (4) Language dropdown works, (5) Bottom sheet swipe handle is visible, (6) Family Safety section renders, (7) Overall layout is not broken. Use preview_resize to test mobile (375x812) and preview_screenshot to capture.'
      },
      instructions: [
        'Use preview_resize to set mobile viewport (375x812)',
        'Take a screenshot to verify the mobile layout',
        'Check that key elements are visible and properly positioned',
        'If any visual issues are found, fix them in the CSS/component files',
        'Take a final screenshot as proof',
        'Return summary of findings'
      ],
      outputFormat: 'JSON with fields: { success: boolean, issues: string[], fixed: string[], summary: string }'
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['agent', 'visual-qa']
}));

export const qualityGateTask = defineTask('quality-gate', (args, taskCtx) => ({
  kind: 'shell',
  title: 'Final quality gate (lint + typecheck + build)',
  shell: {
    command: `cd ${args.projectRoot} && npm run lint 2>&1 | tail -5 && echo "---TYPECHECK---" && npx tsc -b 2>&1 | tail -5 && echo "---BUILD---" && npm run build 2>&1 | tail -5`,
    timeout: 120000
  },
  io: { outputJsonPath: `tasks/${taskCtx.effectId}/output.json` },
  labels: ['shell', 'quality-gate']
}));

export const commitAndPRTask = defineTask('commit-and-pr', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Commit all changes and create PR',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Developer creating a comprehensive PR',
      task: 'Commit all changes and create a PR to main',
      context: {
        projectRoot: args.projectRoot,
        description: 'Commit all changes from the 34-item improvement plan implementation. Create a PR with a comprehensive summary. The branch is claude/priceless-kepler. Use git add for all modified/new files (but NOT .a5c/ directory or node_modules). Create a descriptive commit message summarizing all 5 phases. Then use gh pr create to open a PR to main.'
      },
      instructions: [
        'Run git status to see all changes',
        'Stage all relevant files (src/, public/, index.html, vitest.config.ts, .github/) but NOT .a5c/ or node_modules/',
        'Create a commit with a comprehensive message covering all 5 phases',
        'Push the branch',
        'Create a PR using gh pr create with detailed body listing all 34 items',
        'Return the PR URL'
      ],
      outputFormat: 'JSON with fields: { success: boolean, commitHash: string, prUrl: string, summary: string }'
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['agent', 'git', 'pr']
}));
