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

  it('creates first-run action steps and page-specific empty states from fresh local state', () => {
    const uxModel = createWorkspaceUxModel({
      state: createEmptyWorkspaceState(),
      activePage: 'dashboard',
      selectedSkillDetail: null,
      activeInstallPlan: null,
      discoverPreviewSkills: [],
      installTargets: []
    });

    expect(uxModel.actionSteps.map((step) => step.label)).toEqual([
      'Detect agent roots',
      'Run local scan',
      'Preview a source',
      'Review trust',
      'Create install plan'
    ]);
    expect(uxModel.actionSteps[0]).toMatchObject({
      status: 'current',
      provenance: 'not scanned'
    });
    expect(uxModel.emptyStates.discover).toMatchObject({
      title: 'No sources previewed',
      actionLabel: 'Add local or Git source',
      provenance: 'source preview'
    });
    expect(uxModel.provenanceChips.map((chip) => chip.label)).toContain('not scanned');
  });

  it('summarizes source preview as local trust evidence with no planned writes', () => {
    const uxModel = createWorkspaceUxModel({
      state: createEmptyWorkspaceState(),
      activePage: 'discover',
      selectedSkillDetail: null,
      activeInstallPlan: null,
      discoverPreviewSkills: [
        {
          name: 'Preview Helper',
          description: 'Preview only',
          tags: ['preview'],
          path: 'preview-helper',
          riskStatus: 'safe',
          warnings: ['Unsigned source']
        }
      ],
      installTargets: []
    });

    expect(uxModel.trustImpact.title).toBe('Preview Helper');
    expect(uxModel.trustImpact.rows).toContainEqual({ label: 'Writes planned', value: 'false' });
    expect(uxModel.trustImpact.rows).toContainEqual({ label: 'Risk', value: 'safe' });
    expect(uxModel.diagnostics).toContainEqual(
      expect.objectContaining({
        title: 'Source preview ready',
        action: 'Review candidates before import'
      })
    );
  });

  it('derives compatibility rows and blocked governance diagnostics for selected skills', () => {
    const state = createEmptyWorkspaceState();
    state.securityCenter = {
      queue: [{ skillName: 'Runtime Helper', status: 'blocked' }],
      riskScore: 88,
      level: 'high',
      findings: [{ ruleName: 'Dangerous shell command', severity: 'high' }],
      history: [],
      exemptions: []
    };
    state.reviewCenter.queue = [
      {
        id: 'review-runtime',
        title: 'Runtime Helper security review',
        detail: 'blocked scan',
        reason: 'Dangerous shell command',
        source: 'Security scan',
        reviewer: 'Maintainer',
        risk: 'High',
        status: 'Open',
        skillName: 'Runtime Helper'
      }
    ];
    const uxModel = createWorkspaceUxModel({
      state,
      activePage: 'library',
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
          url: '/tmp/runtime-helper',
          trustLevel: 'verified'
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
        skillMarkdown: '# Runtime Helper',
        latestScan: {
          scanId: 'scan-runtime',
          score: 88,
          level: 'high',
          blocked: true,
          scannedAt: '2026-06-06T00:00:00.000Z'
        },
        installations: [],
        riskStatus: 'high'
      },
      activeInstallPlan: null,
      discoverPreviewSkills: [],
      installTargets: [
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

    expect(uxModel.trustImpact.title).toBe('Runtime Helper');
    expect(uxModel.trustImpact.rows).toContainEqual({ label: 'Security', value: 'blocked' });
    expect(uxModel.compatibilityRows).toContainEqual(
      expect.objectContaining({
        agent: 'Codex',
        status: 'not checked',
        root: '/tmp/.codex/skills'
      })
    );
    expect(uxModel.diagnostics).toContainEqual(
      expect.objectContaining({
        title: 'Blocked install',
        action: 'Open Security or Reviews before applying'
      })
    );
  });
});
