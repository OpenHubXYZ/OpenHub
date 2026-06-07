import { describe, expect, it } from 'vitest';

import {
  createEmptyWorkspaceState,
  createWorkspaceViewModel,
  createWorkspaceUxModel,
  mergeScanIntoWorkspaceState
} from './workspace-view-model';

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

  it('labels the primary workbench page as Dashboard while preserving local state metrics', () => {
    const state = createEmptyWorkspaceState();
    const viewModel = createWorkspaceViewModel(state);
    const uxModel = createWorkspaceUxModel({
      state,
      activePage: 'home',
      selectedSkillDetail: null,
      discoverPreviewSkills: [],
      agentRootTargets: []
    });

    expect(viewModel.navItems.map((item) => item.label)).toEqual([
      'Dashboard',
      'Skills',
      'Settings'
    ]);
    expect(viewModel.dashboard.metrics.map((metric) => metric.label)).toEqual([
      'Library skills',
      'Root locations',
      'App-owned installs'
    ]);
    expect(JSON.stringify(viewModel.navItems)).not.toMatch(/Deploy|Trust|Usage|Reviews|Security|Installs|Discover|Library|Inventory|Sources/);
    expect(uxModel.workflowOwners).toEqual({
      roots: 'settings',
      sourcePreview: 'skills',
      settings: 'settings'
    });
    expect(Object.keys(uxModel.sectionEmptyStates)).toEqual([
      'home',
      'skills',
      'settings'
    ]);
    expect(JSON.stringify(uxModel)).not.toMatch(/trust|deploy|security/i);
  });

  it('keeps scanned local agent skills visible as indexed locations', () => {
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
        agentCode: 'codex',
        visibilityStatus: 'indexed',
        ownership: 'indexed'
      })
    ]);
    expect(viewModel.dashboard.metrics).toContainEqual(
      expect.objectContaining({
        label: 'Library skills',
        value: '1'
      })
    );
  });

  it('creates first-run action steps and source empty states from fresh local state', () => {
    const uxModel = createWorkspaceUxModel({
      state: createEmptyWorkspaceState(),
      activePage: 'home',
      selectedSkillDetail: null,
      discoverPreviewSkills: [],
      agentRootTargets: []
    });

    expect(uxModel.actionSteps.map((step) => step.label)).toEqual([
      'Set local roots',
      'Build skills index',
      'Review marketplace'
    ]);
    expect(uxModel.actionSteps[0]).toMatchObject({
      status: 'current',
      provenance: 'not scanned',
      targetPage: 'settings'
    });
    expect(uxModel.sectionEmptyStates.skills).toMatchObject({
      title: 'No skills indexed',
      actionLabel: 'Add local or Git source',
      provenance: 'skills'
    });
    expect(uxModel.provenanceChips.map((chip) => chip.label)).toContain('not scanned');
  });

  it('summarizes source preview without trust or write impact language', () => {
    const uxModel = createWorkspaceUxModel({
      state: createEmptyWorkspaceState(),
      activePage: 'skills',
      selectedSkillDetail: null,
      discoverPreviewSkills: [
        {
          name: 'Preview Helper',
          description: 'Preview only',
          tags: ['preview'],
          path: 'preview-helper'
        }
      ],
      agentRootTargets: []
    });

    expect(uxModel.selectionSummary.title).toBe('Preview Helper');
    expect(uxModel.selectionSummary.rows).toContainEqual({ label: 'Path', value: 'preview-helper' });
    expect(JSON.stringify(uxModel.selectionSummary)).not.toMatch(/trust|risk|writes/i);
    expect(uxModel.diagnostics).toContainEqual(
      expect.objectContaining({
        title: 'Source preview ready',
        action: 'Review candidates before import'
      })
    );
  });

  it('derives root visibility rows for selected skills without governance diagnostics', () => {
    const state = createEmptyWorkspaceState();
    const uxModel = createWorkspaceUxModel({
      state,
      activePage: 'skills',
      selectedSkillDetail: {
        skill: {
          id: 'skill-runtime',
          versionId: 'version-runtime',
          slug: 'runtime-helper',
          name: 'Runtime Helper',
          description: 'Runtime helper',
          tags: ['runtime'],
          versionNo: 1
        },
        source: {
          type: 'local',
          url: '/tmp/runtime-helper'
        },
        versions: [],
        files: [
          {
            relativePath: 'SKILL.md',
            hash: 'hash-runtime',
            size: 120,
            kind: 'markdown'
          }
        ],
        skillMarkdown: '# Runtime Helper'
      },
      discoverPreviewSkills: [],
      agentRootTargets: [
        {
          agentCode: 'codex',
          agentDisplayName: 'Codex',
          adapterVersion: 'builtin',
          rootPath: '/tmp/.codex/skills',
          scope: 'user',
          rootKind: 'user',
          writable: true,
          isDefault: true
        }
      ]
    });

    expect(uxModel.selectionSummary.title).toBe('Runtime Helper');
    expect(uxModel.selectionSummary.rows).toContainEqual({ label: 'Files', value: '1' });
    expect(uxModel.compatibilityRows).toContainEqual(
      expect.objectContaining({
        agent: 'Codex',
        status: 'not checked',
        root: '/tmp/.codex/skills'
      })
    );
    expect(JSON.stringify(uxModel.diagnostics)).not.toMatch(/blocked|review|security|install/i);
  });
});
