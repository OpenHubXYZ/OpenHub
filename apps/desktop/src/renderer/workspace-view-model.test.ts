import { describe, expect, it } from 'vitest';

import { createEmptyWorkspaceState, createWorkspaceViewModel, mergeScanIntoWorkspaceState } from './workspace-view-model';

describe('workspace view model fixture boundaries', () => {
  it('does not surface fixture-backed data when runtime state is empty', () => {
    const viewModel = createWorkspaceViewModel(createEmptyWorkspaceState());
    const renderedState = JSON.stringify(viewModel).toLowerCase();

    expect(renderedState).not.toContain('fixture');
    expect(renderedState).not.toContain('mock');
    expect(renderedState).not.toContain('openai-docs');
    expect(renderedState).not.toContain('gh-fix-ci');
    expect(renderedState).not.toContain('sui-move-contract');
    expect(renderedState).not.toContain('browser-control');
    expect(renderedState).not.toContain('terraform-helper');
    expect(renderedState).not.toContain('alice.dev');
    expect(renderedState).not.toContain('312');
    expect(renderedState).not.toContain('1482');
  });

  it('does not surface internal mock sync mode labels', () => {
    const state = createEmptyWorkspaceState();
    state.syncCenter.profiles = [{ mode: 'mock-rest', status: 'enabled' }];

    const renderedState = JSON.stringify(createWorkspaceViewModel(state)).toLowerCase();

    expect(renderedState).not.toContain('mock');
    expect(renderedState).toContain('rest contract');
  });

  it('keeps scanned local agent skills installed in the user-visible model', () => {
    const state = createEmptyWorkspaceState();
    const merged = mergeScanIntoWorkspaceState(state, {
      indexedSkills: [
        {
          id: 'skill-openai-docs',
          name: 'openai-docs',
          agentCode: 'codex',
          path: '/Users/a1/.codex/skills/.system/openai-docs',
          files: [{ relativePath: 'SKILL.md', size: 120 }]
        }
      ],
      errors: []
    });
    const viewModel = createWorkspaceViewModel(merged);

    expect(merged.librarySkills).toEqual([
      expect.objectContaining({
        name: 'openai-docs',
        sourceAgent: 'Codex',
        installStatus: 'installed'
      })
    ]);
    expect(viewModel.dashboard.metrics).toContainEqual(
      expect.objectContaining({
        label: 'Installed projections',
        value: '1'
      })
    );
  });
});
