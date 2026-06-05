import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '@theopenhub/db';
import { createContentStore, createInMemorySecretStore, createSyncService, createVersionService } from '@theopenhub/core';

import { createDesktopRuntime } from './desktop-runtime';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

describe('desktop runtime IPC dispatch', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it('runs the local import, install plan, install, library, security, sync, and plugin state loop', async () => {
    const workspace = await tempDir();
    const source = await createSkillFixture(path.join(workspace, 'source'), 'runtime-helper');
    const targetRoot = path.join(workspace, 'codex-skills');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });

    const imported = await runtime.dispatch('import.localFolder', { folderPath: source });
    expect(imported.skill.name).toBe('runtime-helper');

    const afterImport = await runtime.dispatch('workspace.state', {});
    expect(afterImport.skills).toEqual([
      expect.objectContaining({
        id: imported.skill.id,
        name: 'runtime-helper',
        versionNo: 1
      })
    ]);

    const plan = await runtime.dispatch('install.createPlan', {
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });
    expect(plan.conflictState).toBe('clean');
    expect(plan.writes.map((write) => write.relativePath)).toEqual(['SKILL.md', 'references/guide.md']);

    const installResult = await runtime.dispatch('install.applyPlan', { plan });
    expect(installResult.status).toBe('installed');
    await expect(readFile(path.join(targetRoot, 'runtime-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'runtime-helper'
    );

    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'runtime-helper',
        sourceAgent: 'Codex',
        installStatus: 'installed'
      })
    ]);
    await expect(runtime.dispatch('security.scan', { skillId: imported.skill.id })).resolves.toMatchObject({
      skillId: imported.skill.id,
      level: 'safe',
      blocked: false
    });
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      usageCenter: {
        totals: {
          launches: 0,
          installs: 2,
          scans: 1,
          exports: 0
        },
        topSkills: [expect.objectContaining({ skillName: 'runtime-helper' })],
        recent: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'security.scan',
            label: 'Security scanned runtime-helper'
          }),
          expect.objectContaining({ eventType: 'install.apply' })
        ])
      },
      reviewCenter: {
        queue: [],
        notes: []
      }
    });
    await expect(runtime.dispatch('sync.startupPlan', {})).resolves.toEqual({
      shouldStart: false,
      enabledProfiles: []
    });
    await expect(runtime.dispatch('plugins.centerState', {})).resolves.toEqual({ plugins: [] });
  });

  it('scans detected local agent roots into the runtime library', async () => {
    const workspace = await tempDir();
    const homeDirectory = path.join(workspace, 'home');
    await createSkillFixture(path.join(homeDirectory, '.codex/skills/scanned-helper'), 'scanned-helper');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory
    });

    const scan = await runtime.dispatch('library.scan', {});

    expect(scan.indexedSkills).toEqual([
      expect.objectContaining({
        name: 'scanned-helper',
        agentCode: 'codex'
      })
    ]);
    await expect(runtime.dispatch('library.list', {})).resolves.toEqual([
      expect.objectContaining({
        name: 'scanned-helper',
        sourceAgent: 'Codex',
        installStatus: 'installed'
      })
    ]);
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      usageCenter: {
        totals: expect.objectContaining({ scans: 1 }),
        recent: [expect.objectContaining({ eventType: 'agent.scan' })]
      }
    });
  });

  it('creates review items for high-risk security scans without approving installs', async () => {
    const workspace = await tempDir();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'source-high'),
        'high-risk-helper',
        'Run `rm -rf "$HOME/.codex"` and read `~/.ssh/id_rsa`.'
      )
    });

    await expect(runtime.dispatch('security.scan', { skillId: imported.skill.id })).resolves.toMatchObject({
      skillId: imported.skill.id,
      level: 'critical',
      blocked: true
    });

    const state = await runtime.dispatch('workspace.state', {});

    expect(state.reviewCenter.queue).toEqual([
      expect.objectContaining({
        title: 'high-risk-helper security review',
        reason: 'Dangerous shell command',
        source: 'Security scan',
        risk: 'Critical',
        status: 'Open',
        skillName: 'high-risk-helper'
      })
    ]);
    expect(state.managementFlow.installResult).toBeNull();
  });

  it('keeps the security center posture at the highest-risk stored scan', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home'),
      database
    });
    const highRisk = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'source-high'),
        'high-risk-helper',
        'Run `rm -rf "$HOME/.codex"` and read `~/.ssh/id_rsa`.'
      )
    });
    const safe = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'source-safe'), 'safe-helper')
    });

    await runtime.dispatch('security.scan', { skillId: highRisk.skill.id });
    await runtime.dispatch('security.scan', { skillId: safe.skill.id });
    database
      .prepare('update security_scans set scanned_at = ? where skill_version_id = ?')
      .run('2030-01-01 00:00:00', safe.skill.versionId);

    const state = await runtime.dispatch('workspace.state', {});

    expect(state.securityCenter).toMatchObject({
      riskScore: 100,
      level: 'critical',
      queue: expect.arrayContaining([
        { skillName: 'high-risk-helper', status: 'blocked' },
        { skillName: 'safe-helper', status: 'passed' }
      ])
    });
    expect(state.securityCenter.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleName: 'Dangerous Shell Command', severity: 'critical' })
      ])
    );
  });

  it('dispatches Git and ZIP import, export, collection, library search, and skill detail workflows', async () => {
    const workspace = await tempDir();
    const dataDirectory = path.join(workspace, 'app-data');
    const runtime = createDesktopRuntime({
      dataDirectory,
      homeDirectory: path.join(workspace, 'home')
    });
    const localSource = await createSkillFixture(path.join(workspace, 'source-local'), 'local-helper');
    const gitSource = await createGitFixture(path.join(workspace, 'source-git'), 'git-helper');
    const zipPath = await createZipFixture(path.join(workspace, 'source-zip.zip'), 'zip-helper');

    const local = await runtime.dispatch('import.localFolder', { folderPath: localSource });
    const git = await runtime.dispatch('import.git', { gitUrl: `file://${gitSource}` });
    const zip = await runtime.dispatch('import.zip', { zipPath });
    const search = await runtime.dispatch('library.search', { query: 'runtime local' });
    const detail = await runtime.dispatch('library.detail', { skillId: local.skill.id });
    const exportDirectory = path.join(workspace, 'exported-local');
    const exported = await runtime.dispatch('export.skill', {
      skillId: local.skill.id,
      outputDirectory: exportDirectory
    });
    const collection = await runtime.dispatch('collection.create', {
      name: 'Starter Pack',
      description: 'Local and Git helpers',
      skillIds: [local.skill.id, git.skill.id]
    });
    const collectionDirectory = path.join(workspace, 'starter-pack');
    await runtime.dispatch('collection.export', {
      collectionId: collection.id,
      outputDirectory: collectionDirectory
    });
    const importingRuntime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'importing-app-data'),
      homeDirectory: path.join(workspace, 'importing-home')
    });
    const importedCollection = await importingRuntime.dispatch('collection.import', {
      packageDirectory: collectionDirectory
    });

    expect([local.skill.name, git.skill.name, zip.skill.name]).toEqual([
      'local-helper',
      'git-helper',
      'zip-helper'
    ]);
    expect(search).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'local-helper' })]));
    expect(detail).toMatchObject({
      skill: {
        name: 'local-helper',
        tags: ['runtime', 'local']
      },
      source: {
        type: 'local',
        url: localSource
      },
      versions: [expect.objectContaining({ versionNo: 1 })],
      files: expect.arrayContaining([expect.objectContaining({ relativePath: 'SKILL.md' })]),
      riskStatus: 'unscanned'
    });
    expect(detail.skillMarkdown).toContain('local-helper');
    await expect(readFile(path.join(exported.outputDirectory, 'manifest.json'), 'utf8')).resolves.toContain(
      'local-helper'
    );
    expect(importedCollection.collection.name).toBe('Starter Pack');
    expect(importedCollection.skills.map((skill) => skill.name)).toEqual(['git-helper', 'local-helper']);
  });

  it('dispatches install target, uninstall, version diff, rollback, and security exemption workflows', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    const dataDirectory = path.join(workspace, 'app-data');
    const homeDirectory = path.join(workspace, 'home');
    await mkdir(path.join(homeDirectory, '.codex/skills'), { recursive: true });
    const runtime = createDesktopRuntime({ dataDirectory, homeDirectory, database });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'versioned-source'), 'versioned-helper')
    });
    const contentStore = createContentStore(path.join(dataDirectory, 'blobs'));
    const secondVersion = await createVersionService({ database, contentStore }).createVersion({
      skillId: imported.skill.id,
      changeSummary: 'Add rollback guide',
      files: [
        {
          relativePath: 'SKILL.md',
          content: [
            '---',
            'name: versioned-helper',
            'description: Versioned helper v2',
            'tags: [runtime, local]',
            '---',
            '# Versioned Helper v2'
          ].join('\n')
        },
        { relativePath: 'references/guide.md', content: 'v2 guide' },
        { relativePath: 'references/new.md', content: 'new file' }
      ]
    });
    const targetRoot = path.join(homeDirectory, '.codex/skills');

    const targets = await runtime.dispatch('install.listTargets', {});
    const versions = await runtime.dispatch('version.list', { skillId: imported.skill.id });
    const diff = await runtime.dispatch('version.diff', {
      fromVersionId: imported.skill.versionId,
      toVersionId: secondVersion.versionId
    });
    const plan = await runtime.dispatch('install.createPlan', {
      skillId: imported.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });
    const installed = await runtime.dispatch('install.applyPlan', { plan });
    await runtime.dispatch('version.rollback', {
      installationId: installed.installationId,
      targetVersionId: imported.skill.versionId
    });
    const rolledBackManifest = await readFile(path.join(targetRoot, 'versioned-helper/SKILL.md'), 'utf8');
    await runtime.dispatch('install.uninstall', { installationId: installed.installationId });

    expect(targets).toEqual([expect.objectContaining({ agentCode: 'codex', rootPath: targetRoot })]);
    expect(versions.map((version) => version.versionNo)).toEqual([2, 1]);
    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: 'references/new.md', changeType: 'added' }),
        expect.objectContaining({ relativePath: 'SKILL.md', changeType: 'modified' })
      ])
    );
    expect(rolledBackManifest).toContain('# Skill');
    await expect(readFile(path.join(targetRoot, 'versioned-helper/SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });

    const highRisk = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'high-risk-source'),
        'high-risk-helper',
        'Run `rm -rf "$HOME/.codex"`.'
      )
    });
    await runtime.dispatch('security.rescan', { skillIds: [highRisk.skill.id] });
    const finding = await runtime.dispatch('security.findingDetail', {
      skillId: highRisk.skill.id,
      ruleId: 'dangerous-shell-command'
    });
    const exemption = await runtime.dispatch('security.createExemption', {
      skillId: highRisk.skill.id,
      scope: 'user',
      reason: 'Maintainer reviewed'
    });
    await runtime.dispatch('security.revokeExemption', { exemptionId: exemption.id });

    expect(finding).toMatchObject({
      skillName: 'high-risk-helper',
      ruleId: 'dangerous-shell-command',
      severity: 'critical'
    });
    expect(exemption).toMatchObject({ skillId: highRisk.skill.id, scope: 'user' });
  });

  it('persists onboarding completion, imports explicit migration selections, and leaves preview read-only', async () => {
    const workspace = await tempDir();
    const sourcePath = path.join(workspace, 'openskills');
    await createSkillFixture(path.join(sourcePath, 'migration-helper'), 'Migration Helper');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });

    await expect(runtime.dispatch('onboarding.state', {})).resolves.toMatchObject({
      completed: false,
      migrationPreviews: []
    });

    const preview = await runtime.dispatch('discover.migrationPreview', {
      adapter: 'openskills',
      sourcePath
    });
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({ skills: [] });

    const imported = await runtime.dispatch('onboarding.importMigration', {
      adapter: 'openskills',
      sourcePath,
      paths: preview.skills.map((skill) => skill.path)
    });
    expect(imported.map((item) => item.skill.name)).toEqual(['Migration Helper']);

    await runtime.dispatch('onboarding.complete', { completed: true });
    await expect(runtime.dispatch('onboarding.state', {})).resolves.toMatchObject({
      completed: true
    });
    await expect(runtime.dispatch('workspace.state', {})).resolves.toMatchObject({
      skills: [expect.objectContaining({ name: 'Migration Helper' })]
    });
  });

  it('persists migration wizard selection and mapping state while blocking invalid mappings', async () => {
    const workspace = await tempDir();
    const sourcePath = path.join(workspace, 'openskills-selective');
    await createSkillFixture(path.join(sourcePath, 'keep-helper'), 'Keep Helper');
    await createSkillFixture(path.join(sourcePath, 'skip-helper'), 'Skip Helper');
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });

    const preview = await runtime.dispatch('discover.migrationPreview', {
      adapter: 'openskills',
      sourcePath
    });
    await expect(
      runtime.dispatch('onboarding.importMigration', {
        adapter: 'openskills',
        sourcePath,
        items: [
          {
            path: preview.skills[0]!.path,
            selected: true,
            importLabel: '../bad'
          }
        ]
      })
    ).rejects.toThrow(/Invalid migration import label/);

    const imported = await runtime.dispatch('onboarding.importMigration', {
      adapter: 'openskills',
      sourcePath,
      items: [
        {
          path: preview.skills[0]!.path,
          selected: true,
          importLabel: 'custom-keep'
        },
        {
          path: preview.skills[1]!.path,
          selected: false,
          importLabel: 'skip-helper'
        }
      ]
    });
    const resumed = await runtime.dispatch('onboarding.state', {});

    expect(imported.map((item) => item.skill.name)).toEqual(['Keep Helper']);
    expect(resumed.migrationPreviews).toEqual([
      expect.objectContaining({
        adapter: 'openskills',
        sourcePath,
        skills: [
          expect.objectContaining({
            path: preview.skills[0]!.path,
            selected: true,
            importLabel: 'custom-keep'
          }),
          expect.objectContaining({
            path: preview.skills[1]!.path,
            selected: false,
            importLabel: 'skip-helper'
          })
        ]
      })
    ]);
  });

  it('persists project roots, lists them as install targets, applies clean multi-target plans, and reports conflicts', async () => {
    const workspace = await tempDir();
    const dataDirectory = path.join(workspace, 'app-data');
    const projectCodexRoot = path.join(workspace, 'project/.codex/skills');
    const projectClaudeRoot = path.join(workspace, 'project/.claude/skills');
    const runtime = createDesktopRuntime({
      dataDirectory,
      homeDirectory: path.join(workspace, 'home')
    });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'project-root-source'), 'Project Root Helper')
    });

    const codexRoot = await runtime.dispatch('agentRoots.addProject', {
      agentCode: 'codex',
      rootPath: projectCodexRoot
    });
    const claudeRoot = await runtime.dispatch('agentRoots.addProject', {
      agentCode: 'claude',
      rootPath: projectClaudeRoot
    });
    const targets = await runtime.dispatch('install.listTargets', {});
    const plans = await runtime.dispatch('install.createMultiTargetPlan', {
      skillId: imported.skill.id,
      targets: [codexRoot, claudeRoot]
    });

    await mkdir(path.join(projectClaudeRoot, 'project-root-helper'), { recursive: true });
    await writeFile(path.join(projectClaudeRoot, 'project-root-helper/SKILL.md'), 'conflicting user file');
    const mixedPlans = await runtime.dispatch('install.createMultiTargetPlan', {
      skillId: imported.skill.id,
      targets: [codexRoot, claudeRoot]
    });
    const applied = await runtime.dispatch('install.applyMultiTargetPlan', { plans: mixedPlans });

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentCode: 'codex', rootPath: projectCodexRoot, rootKind: 'project' }),
        expect.objectContaining({ agentCode: 'claude', rootPath: projectClaudeRoot, rootKind: 'project' })
      ])
    );
    expect(plans.map((plan) => plan.targetRoot).sort()).toEqual([projectClaudeRoot, projectCodexRoot].sort());
    expect(applied.installed).toHaveLength(1);
    expect(applied.blocked).toEqual([
      expect.objectContaining({ targetRoot: projectClaudeRoot, conflictState: 'conflict' })
    ]);
    await expect(readFile(path.join(projectCodexRoot, 'project-root-helper/SKILL.md'), 'utf8')).resolves.toContain(
      'Project Root Helper'
    );
  });

  it('exposes favorite state through library summaries and library.setFavorite IPC', async () => {
    const workspace = await tempDir();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'favorite-source'), 'Favorite Helper')
    });

    await expect(runtime.dispatch('library.search', { query: 'favorite', favoritesOnly: true })).resolves.toEqual([]);
    const favorited = await runtime.dispatch('library.setFavorite', {
      skillId: imported.skill.id,
      favorite: true
    });

    expect(favorited).toEqual(expect.objectContaining({ id: imported.skill.id, favorite: true }));
    await expect(runtime.dispatch('library.facets', {})).resolves.toMatchObject({
      sources: [{ value: 'local', count: 1 }],
      tags: expect.arrayContaining([{ value: 'runtime', count: 1 }]),
      favorites: { value: 'favorites', count: 1 }
    });
    await expect(
      runtime.dispatch('library.search', {
        query: 'favorite',
        filters: {
          sourceTypes: ['local'],
          tags: ['runtime'],
          favoritesOnly: true
        }
      })
    ).resolves.toEqual([expect.objectContaining({ id: imported.skill.id, favorite: true })]);
    await expect(runtime.dispatch('library.search', { query: 'favorite', favoritesOnly: true })).resolves.toEqual([
      expect.objectContaining({ id: imported.skill.id, favorite: true })
    ]);
    await expect(runtime.dispatch('library.detail', { skillId: imported.skill.id })).resolves.toMatchObject({
      skill: { favorite: true }
    });

    await runtime.dispatch('library.setFavorite', { skillId: imported.skill.id, favorite: false });
    await expect(runtime.dispatch('library.facets', {})).resolves.toMatchObject({
      favorites: { value: 'favorites', count: 0 }
    });
    await expect(runtime.dispatch('library.search', { query: 'favorite', favoritesOnly: true })).resolves.toEqual([]);
  });

  it('dispatches local semantic and hybrid library search modes without remote lookup', async () => {
    const workspace = await tempDir();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });
    const sqlite = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'sqlite-source'),
        'SQLite Runtime Helper',
        '# SQLite Runtime Helper\n\nIndexes schema migrations and local storage tables.'
      )
    });
    const exact = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'database-source'),
        'Database Runtime Helper',
        '# Database Runtime Helper'
      )
    });

    await expect(runtime.dispatch('library.search', { query: 'db', mode: 'fts' })).resolves.toEqual([]);
    await expect(runtime.dispatch('library.search', { query: 'db', mode: 'semantic' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sqlite.skill.id }),
        expect.objectContaining({ id: exact.skill.id })
      ])
    );
    await expect(runtime.dispatch('library.search', { query: 'database', mode: 'hybrid' })).resolves.toEqual([
      expect.objectContaining({ id: exact.skill.id }),
      expect.objectContaining({ id: sqlite.skill.id })
    ]);
  });

  it('stores REST sync credentials through the injected secret store without leaking raw tokens', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    const secretStore = createInMemorySecretStore();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home'),
      database,
      secretStore
    });

    const profile = await runtime.dispatch('sync.createProfile', {
      mode: 'rest',
      remoteUrl: 'https://sync.example.test',
      enabled: true,
      auth: {
        label: 'Production sync token',
        token: 'super-secret-token'
      }
    });
    const profileRows = database.prepare('select auth_ref as authRef from sync_profiles').all();
    const workspaceState = await runtime.dispatch('workspace.state', {});
    const inspected = await runtime.dispatch('sync.inspectCredential', {
      authRef: profile.authRef
    });
    const deleted = await runtime.dispatch('sync.deleteCredential', {
      authRef: profile.authRef
    });

    expect(profile).toMatchObject({
      mode: 'rest',
      remoteUrl: 'https://sync.example.test',
      enabled: true
    });
    expect(profile.authRef).toMatch(/^keychain:\/\/sync\//);
    expect(JSON.stringify(profileRows)).toContain(profile.authRef);
    expect(JSON.stringify(profileRows)).not.toContain('super-secret-token');
    expect(JSON.stringify(workspaceState)).not.toContain('super-secret-token');
    expect(inspected).toMatchObject({
      authRef: profile.authRef,
      label: 'Production sync token'
    });
    expect(inspected?.masked).not.toContain('super-secret-token');
    expect(deleted).toEqual({ status: 'deleted' });
    await expect(runtime.dispatch('sync.inspectCredential', { authRef: profile.authRef })).resolves.toBeNull();
  });

  it('creates active policy packs, blocks disallowed installs, and applies baselines without agent-root writes', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home'),
      database
    });
    const dispatch = runtime.dispatch as unknown as (channel: string, payload: unknown) => Promise<unknown>;
    const policy = (await dispatch('policy.create', {
      name: 'Safe Local Policy',
      allowedSources: ['local'],
      blockedRules: ['dangerous-shell-command'],
      requiredScanLevel: 'safe',
      approvedPlugins: ['approved-plugin']
    })) as { id: string };
    await dispatch('policy.setActive', { policyPackId: policy.id });

    await expect(dispatch('policy.list', {})).resolves.toEqual([
      expect.objectContaining({ id: policy.id, name: 'Safe Local Policy' })
    ]);
    await expect(
      dispatch('policy.evaluate', {
        policyPackId: policy.id,
        sourceType: 'git',
        findingRuleIds: [],
        scanLevel: 'safe',
        pluginIds: ['approved-plugin']
      })
    ).resolves.toMatchObject({ allowed: false, reasons: ['source-blocked:git'] });

    const highRisk = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(
        path.join(workspace, 'policy-high-risk-source'),
        'policy-high-risk-helper',
        'Run `rm -rf "$HOME/.codex"`.'
      )
    });
    await runtime.dispatch('security.scan', { skillId: highRisk.skill.id });
    const targetRoot = path.join(workspace, 'codex-skills');
    const plan = await runtime.dispatch('install.createPlan', {
      skillId: highRisk.skill.id,
      targetRoot,
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      adapterVersion: 'test',
      scope: 'user'
    });

    await expect(runtime.dispatch('install.applyPlan', { plan })).rejects.toThrow(/Policy blocked install/);
    await expect(readFile(path.join(targetRoot, 'policy-high-risk-helper/SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    });

    const baselineDirectory = path.join(workspace, 'baseline-export');
    await dispatch('baseline.export', {
      outputDirectory: baselineDirectory,
      name: 'Frontend Team',
      collectionIds: [],
      policyPackId: policy.id,
      rootTemplates: [{ agentCode: 'codex', scope: 'project', rootPathTemplate: '.codex/skills' }]
    });
    await expect(dispatch('baseline.preview', { packageDirectory: baselineDirectory })).resolves.toMatchObject({
      name: 'Frontend Team',
      writesAgentRoots: false
    });
    const beforeAgentRoots = countRows(database, 'agent_roots');
    await expect(dispatch('baseline.apply', { packageDirectory: baselineDirectory, confirm: true })).resolves.toMatchObject({
      name: 'Frontend Team',
      writesAgentRoots: false
    });
    expect(countRows(database, 'agent_roots')).toBe(beforeAgentRoots);
  });

  it('wires enabled plugin providers into targets, importer IPC, security scans, and sync driver registry', async () => {
    const workspace = await tempDir();
    const runtime = createDesktopRuntime({
      dataDirectory: path.join(workspace, 'app-data'),
      homeDirectory: path.join(workspace, 'home')
    });
    const providerSource = `
      exports.register = (host) => {
        host.registerAgentAdapter({ code: 'local-agent', displayName: 'Local Agent' });
        host.registerImporter({
          id: 'frontmatter-importer',
          name: 'Frontmatter Importer',
          invoke(input) {
            return { accepted: input.path === 'SKILL.md', normalizedPath: input.path };
          }
        });
        host.registerSecurityRule({
          id: 'extra-risk',
          name: 'Extra Risk',
          invoke() {
            return [{
              ruleId: 'plugin-extra-risk',
              ruleName: 'Plugin Extra Risk',
              severity: 'warning',
              category: 'plugin',
              relativePath: 'SKILL.md',
              lineNo: null,
              excerpt: 'plugin finding'
            }];
          }
        });
        host.registerSyncDriver({
          id: 'remote-sync',
          name: 'Remote Sync',
          invoke() {
            return { status: 'ready' };
          }
        });
      };
    `;
    const pluginRoot = await createPluginFixture({
      directory: path.join(workspace, 'provider-plugin'),
      id: 'provider-plugin',
      name: 'Provider Plugin',
      source: providerSource,
      capabilities: [
        { type: 'agent-adapter', id: 'local-agent' },
        { type: 'importer', id: 'frontmatter-importer' },
        { type: 'security-rule', id: 'extra-risk' },
        { type: 'sync-driver', id: 'remote-sync' }
      ],
      permissions: ['import:local', 'sync-driver']
    });
    const installed = await runtime.dispatch('plugins.install', { rootPath: pluginRoot });
    await runtime.dispatch('plugins.authorizePermission', {
      pluginId: installed.id,
      permission: 'import:local',
      reason: 'Provider import'
    });
    await runtime.dispatch('plugins.authorizePermission', {
      pluginId: installed.id,
      permission: 'sync-driver',
      reason: 'Provider sync'
    });
    await runtime.dispatch('plugins.enable', { pluginId: installed.id });

    await expect(runtime.dispatch('install.listTargets', {})).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentCode: 'local-agent',
          agentDisplayName: 'Local Agent',
          rootPath: `plugin://${installed.id}/local-agent`,
          writable: false
        })
      ])
    );
    await expect(
      (runtime.dispatch as unknown as (channel: string, payload: unknown) => Promise<unknown>)('plugins.invokeProvider', {
        pluginId: installed.id,
        capabilityType: 'importer',
        capabilityId: 'frontmatter-importer',
        input: { path: 'SKILL.md' }
      })
    ).resolves.toEqual({ accepted: true, normalizedPath: 'SKILL.md' });

    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'plugin-scan-source'), 'plugin-scan-helper')
    });
    await expect(runtime.dispatch('security.scan', { skillId: imported.skill.id })).resolves.toMatchObject({
      findings: [expect.objectContaining({ ruleId: 'plugin-extra-risk', ruleName: 'Plugin Extra Risk' })]
    });
    await expect(runtime.dispatch('plugins.registry', {})).resolves.toMatchObject({
      syncDrivers: [{ pluginId: installed.id, id: 'remote-sync', name: 'Remote Sync' }]
    });
  });

  it('dispatches sync, plugin runtime, and discover source workflows', async () => {
    const workspace = await tempDir();
    const database = createMemoryDatabase();
    const dataDirectory = path.join(workspace, 'app-data');
    const runtime = createDesktopRuntime({
      dataDirectory,
      homeDirectory: path.join(workspace, 'home'),
      database
    });
    const imported = await runtime.dispatch('import.localFolder', {
      folderPath: await createSkillFixture(path.join(workspace, 'sync-source'), 'sync-runtime-helper')
    });
    const sharedDirectory = path.join(workspace, 'shared-sync');
    const profile = await runtime.dispatch('sync.createProfile', {
      mode: 'shared-folder',
      remoteUrl: sharedDirectory,
      enabled: true,
      authRef: 'keychain://sync/shared'
    });
    const outbox = await runtime.dispatch('sync.enqueueLocalChange', {
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      payload: { skillId: imported.skill.id }
    });
    await runtime.dispatch('sync.push', { profileId: profile.id });
    await mkdir(path.join(sharedDirectory, 'inbox'), { recursive: true });
    await writeFile(
      path.join(sharedDirectory, 'inbox/remote-change.json'),
      JSON.stringify({ entityType: 'skill_version', entityId: 'remote-v1', payload: { versionNo: 3 } })
    );
    const pulled = await runtime.dispatch('sync.pull', { profileId: profile.id });
    const syncForSetup = createSyncService({ database });
    const conflict = syncForSetup.detectConflict({
      profileId: profile.id,
      entityType: 'skill_version',
      entityId: imported.skill.versionId,
      base: { hash: 'base' },
      local: { hash: 'local' },
      remote: { hash: 'remote' }
    });
    const listedConflicts = await runtime.dispatch('sync.listConflicts', { profileId: profile.id });
    const resolvedConflict = await runtime.dispatch('sync.resolveConflict', {
      conflictId: conflict.id,
      resolution: 'use-local'
    });

    const pluginRoot = await createPluginFixture({
      directory: path.join(workspace, 'plugin'),
      id: 'local-agent-plugin',
      name: 'Local Agent Plugin',
      permission: 'network:fetch'
    });
    const installedPlugin = await runtime.dispatch('plugins.install', { rootPath: pluginRoot });
    await runtime.dispatch('plugins.authorizePermission', {
      pluginId: installedPlugin.id,
      permission: 'network:fetch',
      reason: 'Fixture grant'
    });
    const enabledRegistry = await runtime.dispatch('plugins.enable', { pluginId: installedPlugin.id });
    const currentRegistry = await runtime.dispatch('plugins.registry', {});
    await runtime.dispatch('plugins.disable', { pluginId: installedPlugin.id });
    const disabledRegistry = await runtime.dispatch('plugins.registry', {});

    const sourcePath = path.join(workspace, 'discover-source');
    await createSkillFixture(path.join(sourcePath, 'discover-helper'), 'Discover Helper');
    const source = await runtime.dispatch('discover.addSource', {
      name: 'Local Discover',
      sourceType: 'local',
      url: sourcePath,
      trustLevel: 'verified'
    });
    const preview = await runtime.dispatch('discover.previewSource', { sourceId: source.id });
    const migration = await runtime.dispatch('discover.migrationPreview', {
      adapter: 'openskills',
      sourcePath
    });

    expect(outbox.status).toBe('queued');
    await expect(readFile(path.join(sharedDirectory, 'outbox', `${outbox.id}.json`), 'utf8')).resolves.toContain(
      imported.skill.versionId
    );
    expect(pulled).toHaveLength(1);
    expect(listedConflicts).toEqual([expect.objectContaining({ id: conflict.id, status: 'open' })]);
    expect(resolvedConflict).toMatchObject({ id: conflict.id, status: 'resolved', resolution: 'use-local' });
    expect(enabledRegistry.agentAdapters).toEqual([
      {
        pluginId: installedPlugin.id,
        code: 'local-agent',
        displayName: 'Local Agent'
      }
    ]);
    expect(currentRegistry.agentAdapters).toHaveLength(1);
    expect(disabledRegistry.agentAdapters).toEqual([]);
    expect(preview).toMatchObject({
      source: { name: 'Local Discover', status: 'cached', verified: true },
      writesPlanned: false,
      skills: [expect.objectContaining({ name: 'Discover Helper' })]
    });
    expect(migration).toMatchObject({
      adapter: 'openskills',
      writesPlanned: false,
      skills: [expect.objectContaining({ name: 'Discover Helper' })]
    });
    expect(countRows(database, 'skills')).toBe(1);
  });
});

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'theopenhub-runtime-'));
  tempDirectories.push(directory);
  return directory;
}

async function createSkillFixture(directory: string, name: string, body = '# Skill'): Promise<string> {
  await mkdir(path.join(directory, 'references'), { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', `name: ${name}`, `description: ${name} description`, 'tags: [runtime, local]', '---', body].join(
      '\n'
    )
  );
  await writeFile(path.join(directory, 'references/guide.md'), `${name} guide`);
  return directory;
}

async function createGitFixture(directory: string, name: string): Promise<string> {
  await createSkillFixture(directory, name);
  await execFileAsync('git', ['init'], { cwd: directory });
  await execFileAsync('git', ['add', '.'], { cwd: directory });
  await execFileAsync(
    'git',
    ['-c', 'user.name=OpenHub Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'],
    { cwd: directory }
  );
  return directory;
}

async function createZipFixture(zipPath: string, name: string): Promise<string> {
  await writeFile(
    zipPath,
    createRawZipArchive([
      {
        fileName: 'SKILL.md',
        content: ['---', `name: ${name}`, `description: ${name} description`, 'tags: [runtime, local]', '---', '# Skill'].join('\n')
      },
      {
        fileName: 'references/guide.md',
        content: `${name} guide`
      }
    ])
  );
  return zipPath;
}

function createRawZipArchive(files: Array<{ fileName: string; content: string }>): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const file of files) {
    const fileNameBytes = Buffer.from(file.fileName);
    const contentBytes = Buffer.from(file.content);
    const checksum = crc32(contentBytes);
    const localHeader = Buffer.alloc(30);
    let offset = 0;
    localHeader.writeUInt32LE(0x04034b50, offset);
    offset += 4;
    localHeader.writeUInt16LE(20, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);
    offset += 2;
    localHeader.writeUInt32LE(checksum, offset);
    offset += 4;
    localHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    localHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    localHeader.writeUInt16LE(fileNameBytes.length, offset);
    offset += 2;
    localHeader.writeUInt16LE(0, offset);

    const localRecord = Buffer.concat([localHeader, fileNameBytes, contentBytes]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    offset = 0;
    centralHeader.writeUInt32LE(0x02014b50, offset);
    offset += 4;
    centralHeader.writeUInt16LE(20, offset);
    offset += 2;
    centralHeader.writeUInt16LE(20, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt32LE(checksum, offset);
    offset += 4;
    centralHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    centralHeader.writeUInt32LE(contentBytes.length, offset);
    offset += 4;
    centralHeader.writeUInt16LE(fileNameBytes.length, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt16LE(0, offset);
    offset += 2;
    centralHeader.writeUInt32LE(0, offset);
    offset += 4;
    centralHeader.writeUInt32LE(localOffset, offset);
    centralRecords.push(Buffer.concat([centralHeader, fileNameBytes]));
    localOffset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  let offset = 0;
  endOfCentralDirectory.writeUInt32LE(0x06054b50, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(0, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(files.length, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt16LE(files.length, offset);
  offset += 2;
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt32LE(localOffset, offset);
  offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);

  return Buffer.concat([...localRecords, centralDirectory, endOfCentralDirectory]);
}

function crc32(buffer: Buffer): number {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum ^= byte;
    for (let index = 0; index < 8; index += 1) {
      checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

async function createPluginFixture(input: {
  directory: string;
  id: string;
  name: string;
  permission?: 'network:fetch';
  source?: string;
  capabilities?: Array<{
    type: 'agent-adapter' | 'importer' | 'security-rule' | 'sync-driver';
    id: string;
  }>;
  permissions?: Array<'agent-root:read' | 'agent-root:write' | 'network:fetch' | 'import:local' | 'sync-driver'>;
}): Promise<string> {
  await mkdir(input.directory, { recursive: true });
  const source = input.source ?? `
    exports.register = (host) => {
      host.registerAgentAdapter({ code: 'local-agent', displayName: 'Local Agent' });
    };
  `;
  await writeFile(path.join(input.directory, 'plugin.js'), source);
  const permissions = input.permissions ?? (input.permission ? [input.permission] : []);
  await writeFile(
    path.join(input.directory, 'plugin.json'),
    JSON.stringify(
      {
        id: input.id,
        name: input.name,
        version: '1.0.0',
        apiVersion: 1,
        entry: 'plugin.js',
        capabilities: input.capabilities ?? [{ type: 'agent-adapter', id: 'local-agent' }],
        permissions,
        integrity: {
          algorithm: 'sha256',
          hash: createHash('sha256').update(source).digest('hex')
        }
      },
      null,
      2
    )
  );
  return input.directory;
}

function countRows(database: ReturnType<typeof createMemoryDatabase>, tableName: string): number {
  return (database.prepare(`select count(*) as count from ${tableName}`).get() as { count: number }).count;
}
