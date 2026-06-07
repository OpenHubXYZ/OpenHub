import { z } from 'zod';

export const PRODUCT_NAME = 'OpenHub';
export const CURRENT_PHASE = 'Phase 10';

export const appInfoResponseSchema = z
  .object({
    productName: z.literal(PRODUCT_NAME),
    phase: z.literal(CURRENT_PHASE),
    localFirst: z.literal(true)
  })
  .strict();

export type AppInfo = z.infer<typeof appInfoResponseSchema>;

export const librarySkillSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    sourceAgent: z.string().min(1),
    agentCode: z.string().min(1),
    path: z.string().min(1),
    visibilityStatus: z.string().min(1),
    rootPath: z.string().min(1),
    scope: z.string().min(1),
    rootKind: z.enum(['user', 'project']),
    writable: z.boolean(),
    installationId: z.string().min(1).optional(),
    sourceUrl: z.string().min(1).optional(),
    ownership: z.enum(['indexed', 'app-owned']),
    favorite: z.boolean().optional()
  })
  .strict();

export type LibrarySkillSummary = z.infer<typeof librarySkillSummarySchema>;

export const skillSummarySchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    versionNo: z.number().int().positive(),
    favorite: z.boolean().optional()
  })
  .strict();

export type SkillSummary = z.infer<typeof skillSummarySchema>;

const librarySearchFiltersSchema = z
  .object({
    sourceTypes: z.array(z.string().min(1)).optional(),
    agentCodes: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    favoritesOnly: z.boolean().optional()
  })
  .strict();

export type LibrarySearchFilters = z.infer<typeof librarySearchFiltersSchema>;

const libraryFacetValueSchema = z
  .object({
    value: z.string().min(1),
    count: z.number().int().nonnegative()
  })
  .strict();

export const libraryFacetsSchema = z
  .object({
    sources: z.array(libraryFacetValueSchema),
    agents: z.array(libraryFacetValueSchema),
    tags: z.array(libraryFacetValueSchema),
    favorites: libraryFacetValueSchema
  })
  .strict();

export type LibraryFacets = z.infer<typeof libraryFacetsSchema>;

export const libraryScanResultSchema = z
  .object({
    indexedSkills: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          agentCode: z.string().min(1),
          path: z.string().min(1),
          files: z.array(
            z
              .object({
                relativePath: z.string().min(1),
                size: z.number().int().nonnegative()
              })
              .strict()
          )
        })
        .strict()
    ),
    errors: z.array(
      z
        .object({
          agentCode: z.string().min(1),
          code: z.string().min(1),
          skillPath: z.string().min(1),
          message: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type LibraryScanResult = z.infer<typeof libraryScanResultSchema>;

export const importedSkillResultSchema = z
  .object({
    skill: skillSummarySchema,
    files: z.array(
      z
        .object({
          relativePath: z.string().min(1),
          hash: z.string().min(1),
          size: z.number().int().nonnegative()
        })
        .strict()
    ),
    stagedFrom: z.string().min(1)
  })
  .strict();

export type ImportedSkillResult = z.infer<typeof importedSkillResultSchema>;

const projectionModeSchema = z.enum(['copy', 'symlink']);
const rootKindSchema = z.enum(['user', 'project']);

const installPlanWriteSchema = z
  .object({
    relativePath: z.string().min(1),
    targetPath: z.string().min(1),
    sourceHash: z.string().min(1),
    action: projectionModeSchema,
    status: z.enum(['clean', 'conflict', 'blocked']),
    reason: z.string().min(1).optional()
  })
  .strict();

export const installPlanSchema = z
  .object({
    id: z.string().min(1),
    skillId: z.string().min(1),
    skillVersionId: z.string().min(1),
    skillName: z.string().min(1),
    skillSlug: z.string().min(1),
    targetRoot: z.string().min(1),
    targetSkillPath: z.string().min(1),
    agentCode: z.string().min(1),
    agentDisplayName: z.string().min(1),
    adapterVersion: z.string().min(1),
    scope: z.string().min(1),
    rootKind: rootKindSchema.optional(),
    projectionMode: projectionModeSchema,
    status: z.enum(['ready', 'conflict', 'blocked']),
    writes: z.array(installPlanWriteSchema)
  })
  .strict();

export type InstallPlan = z.infer<typeof installPlanSchema>;

export const installResultSchema = z
  .object({
    status: z.literal('installed'),
    installationId: z.string().min(1),
    skillId: z.string().min(1),
    targetSkillPath: z.string().min(1),
    files: z.array(installPlanWriteSchema)
  })
  .strict();

export type InstallResult = z.infer<typeof installResultSchema>;

const managementFlowStateSchema = z
  .object({
    importItems: z.array(
      z
        .object({
          label: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type ManagementFlowState = z.infer<typeof managementFlowStateSchema>;

const governanceStateSchema = z
  .object({
    history: z.array(
      z
        .object({
          versionNo: z.number().int().positive(),
          summary: z.string()
        })
        .strict()
    ),
    diff: z.array(
      z
        .object({
          relativePath: z.string().min(1),
          changeType: z.string().min(1)
        })
        .strict()
    ),
    collections: z.array(
      z
        .object({
          name: z.string().min(1),
          skillCount: z.number().int().nonnegative()
        })
        .strict()
    )
  })
  .strict();

export type GovernanceState = z.infer<typeof governanceStateSchema>;

const syncCenterStateSchema = z
  .object({
    profiles: z.array(
      z
        .object({
          mode: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    ),
    outbox: z.array(
      z
        .object({
          entityType: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    ),
    inbox: z.array(
      z
        .object({
          entityType: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    ),
    conflicts: z.array(
      z
        .object({
          entityType: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type SyncCenterState = z.infer<typeof syncCenterStateSchema>;

const pluginPermissionSchema = z.enum(['agent-root:read', 'network:fetch', 'import:local', 'sync-driver']);
const pluginCapabilityTypeSchema = z.enum(['agent-adapter', 'importer', 'sync-driver']);

const pluginDirectoryRecordSchema = z
  .object({
    id: z.string().min(1),
    rootPath: z.string().min(1),
    status: z.string().min(1),
    scannedAt: z.string().min(1).nullable()
  })
  .strict();

const pluginCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    directoryId: z.string().min(1),
    pluginId: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    rootPath: z.string().min(1),
    installed: z.boolean(),
    status: z.string().min(1),
    errorMessage: z.string().nullable().optional()
  })
  .strict();

const pluginsStateSchema = z
  .object({
    directories: z.array(pluginDirectoryRecordSchema).default([]),
    catalog: z.array(pluginCatalogEntrySchema).default([]),
    plugins: z.array(
      z
        .object({
          id: z.string().min(1).optional(),
          name: z.string().min(1),
          version: z.string().min(1).optional(),
          rootPath: z.string().min(1).optional(),
          status: z.string().min(1),
          capabilities: z.array(z.string().min(1)),
          permissions: z.array(
            z
              .object({
                name: z.string().min(1),
                status: z.string().min(1)
              })
              .strict()
          ),
          errors: z.array(
            z
              .object({
                message: z.string().min(1)
              })
              .strict()
          )
        })
        .strict()
    )
  })
  .strict();

export type PluginsState = z.infer<typeof pluginsStateSchema>;
export type PluginDirectoryRecord = z.infer<typeof pluginDirectoryRecordSchema>;
export type PluginCatalogEntry = z.infer<typeof pluginCatalogEntrySchema>;

export const pluginDirectoryScanResultSchema = z
  .object({
    directory: pluginDirectoryRecordSchema,
    catalog: z.array(pluginCatalogEntrySchema)
  })
  .strict();

export type PluginDirectoryScanResult = z.infer<typeof pluginDirectoryScanResultSchema>;

const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const mirrorSourceSettingSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    url: z.string().min(1)
  })
  .strict();

export const appSettingsSchema = z
  .object({
    mirrorSources: z.array(mirrorSourceSettingSchema),
    updateChecksEnabled: z.boolean(),
    logLevel: logLevelSchema,
    pluginDirectories: z.array(pluginDirectoryRecordSchema)
  })
  .strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const desktopWorkspaceStateSchema = z
  .object({
    appInfo: appInfoResponseSchema,
    librarySkills: z.array(librarySkillSummarySchema),
    skills: z.array(skillSummarySchema),
    managementFlow: managementFlowStateSchema,
    governance: governanceStateSchema,
    syncCenter: syncCenterStateSchema,
    plugins: pluginsStateSchema
  })
  .strict();

export type DesktopWorkspaceState = z.infer<typeof desktopWorkspaceStateSchema>;

export const syncStartupPlanSchema = z
  .object({
    shouldStart: z.boolean(),
    enabledProfiles: z.array(
      z
        .object({
          id: z.string().min(1),
          mode: z.string().min(1),
          remoteUrl: z.string().min(1),
          enabled: z.boolean()
        })
        .strict()
    )
  })
  .strict();

export type SyncStartupPlan = z.infer<typeof syncStartupPlanSchema>;

export const collectionRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string()
  })
  .strict();

export type CollectionRecord = z.infer<typeof collectionRecordSchema>;

const skillFileSummarySchema = z
  .object({
    relativePath: z.string().min(1),
    hash: z.string().min(1),
    size: z.number().int().nonnegative(),
    kind: z.string().min(1)
  })
  .strict();

export type SkillFileSummary = z.infer<typeof skillFileSummarySchema>;

const skillVersionSummarySchema = z
  .object({
    versionId: z.string().min(1),
    skillId: z.string().min(1),
    versionNo: z.number().int().positive(),
    changeSummary: z.string(),
    createdAt: z.string().min(1)
  })
  .strict();

export type SkillVersionSummary = z.infer<typeof skillVersionSummarySchema>;

const fileDiffSchema = z
  .object({
    relativePath: z.string().min(1),
    changeType: z.enum(['added', 'modified', 'deleted']),
    fromHash: z.string().min(1).nullable(),
    toHash: z.string().min(1).nullable()
  })
  .strict();

export type FileDiff = z.infer<typeof fileDiffSchema>;

export const versionComparisonReportSchema = z
  .object({
    fromVersionId: z.string().min(1),
    toVersionId: z.string().min(1),
    fromManifestHash: z.string().min(1).nullable(),
    toManifestHash: z.string().min(1).nullable(),
    manifestHashChanged: z.boolean(),
    files: z.array(fileDiffSchema)
  })
  .strict();

export type VersionComparisonReport = z.infer<typeof versionComparisonReportSchema>;

export const skillDetailSchema = z
  .object({
    skill: z
      .object({
        id: z.string().min(1),
        versionId: z.string().min(1),
        slug: z.string().min(1),
        name: z.string().min(1),
        description: z.string(),
        tags: z.array(z.string()),
        versionNo: z.number().int().positive(),
        favorite: z.boolean().optional()
      })
      .strict(),
    source: z
      .object({
        type: z.string().min(1),
        url: z.string().nullable()
      })
      .strict(),
    versions: z.array(skillVersionSummarySchema),
    files: z.array(skillFileSummarySchema),
    skillMarkdown: z.string()
  })
  .strict();

export type SkillDetail = z.infer<typeof skillDetailSchema>;

const agentRootTargetSchema = z
  .object({
    agentCode: z.string().min(1),
    agentDisplayName: z.string().min(1),
    adapterVersion: z.string().min(1),
    rootPath: z.string().min(1),
    scope: z.string().min(1),
    rootKind: z.enum(['user', 'project']).optional(),
    writable: z.boolean(),
    isDefault: z.boolean()
  })
  .strict();

export type AgentRootTarget = z.infer<typeof agentRootTargetSchema>;

const syncModeSchema = z.enum(['disabled', 'shared-folder', 'git', 'rest']);

const syncProfileSchema = z
  .object({
    id: z.string().min(1),
    mode: syncModeSchema,
    remoteUrl: z.string().min(1),
    authRef: z.string().nullable(),
    enabled: z.boolean(),
    lastSyncedAt: z.string().nullable()
  })
  .strict();

export type SyncProfile = z.infer<typeof syncProfileSchema>;

const syncOutboxRecordSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    status: z.string().min(1),
    sentAt: z.string().nullable()
  })
  .strict();

export type SyncOutboxRecord = z.infer<typeof syncOutboxRecordSchema>;

const syncInboxRecordSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string().min(1),
    remoteEventId: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    status: z.string().min(1),
    appliedAt: z.string().nullable()
  })
  .strict();

export type SyncInboxRecord = z.infer<typeof syncInboxRecordSchema>;

const syncConflictRecordSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    status: z.string().min(1),
    resolution: z.string().nullable(),
    resolvedAt: z.string().nullable()
  })
  .strict();

export type SyncConflictRecord = z.infer<typeof syncConflictRecordSchema>;

const pluginInstallResultSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    status: z.string().min(1),
    rootPath: z.string().min(1)
  })
  .strict();

export type PluginInstallResult = z.infer<typeof pluginInstallResultSchema>;

const pluginRegistrySchema = z
  .object({
    agentAdapters: z.array(
      z
        .object({
          pluginId: z.string().min(1),
          code: z.string().min(1),
          displayName: z.string().min(1)
        })
        .strict()
    ),
    importers: z.array(
      z
        .object({
          pluginId: z.string().min(1),
          id: z.string().min(1),
          name: z.string().min(1)
        })
        .strict()
    ),
    syncDrivers: z.array(
      z
        .object({
          pluginId: z.string().min(1),
          id: z.string().min(1),
          name: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type PluginRegistry = z.infer<typeof pluginRegistrySchema>;

export const statusOnlyResultSchema = z
  .object({
    status: z.string().min(1)
  })
  .strict();

export type StatusOnlyResult = z.infer<typeof statusOnlyResultSchema>;

export const discoverSourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    sourceType: z.enum(['local', 'git']),
    url: z.string().min(1),
    status: z.string().min(1),
    cachedAt: z.string().nullable(),
    verified: z.boolean()
  })
  .strict();

export type DiscoverSource = z.infer<typeof discoverSourceSchema>;

const discoverSkillPreviewSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    tags: z.array(z.string()),
    path: z.string().min(1)
  })
  .strict();

export type DiscoverSkillPreview = z.infer<typeof discoverSkillPreviewSchema>;

const discoverPreviewResultSchema = z
  .object({
    source: discoverSourceSchema,
    skills: z.array(discoverSkillPreviewSchema),
    cachedAt: z.string().min(1)
  })
  .strict();

export type DiscoverPreviewResult = z.infer<typeof discoverPreviewResultSchema>;

export const onboardingStateSchema = z
  .object({
    completed: z.boolean(),
    detectedRoots: z.array(agentRootTargetSchema)
  })
  .strict();

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

const emptyRequestSchema = z.object({}).strict();
const skillIdRequestSchema = z.object({ skillId: z.string().min(1) }).strict();

export const appInfo: AppInfo = {
  productName: PRODUCT_NAME,
  phase: CURRENT_PHASE,
  localFirst: true
};

export const desktopShellContract = {
  appInfo: {
    channel: 'app.info',
    request: emptyRequestSchema,
    response: appInfoResponseSchema
  },
  onboardingState: {
    channel: 'onboarding.state',
    request: emptyRequestSchema,
    response: onboardingStateSchema
  },
  onboardingComplete: {
    channel: 'onboarding.complete',
    request: z.object({ completed: z.boolean() }).strict(),
    response: onboardingStateSchema
  },
  agentRootsAddProject: {
    channel: 'agentRoots.addProject',
    request: z.object({ agentCode: z.string().min(1), rootPath: z.string().min(1) }).strict(),
    response: agentRootTargetSchema
  },
  agentRootsRemoveProject: {
    channel: 'agentRoots.removeProject',
    request: z.object({ agentCode: z.string().min(1), rootPath: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  agentRootsList: {
    channel: 'agentRoots.list',
    request: emptyRequestSchema,
    response: z.array(agentRootTargetSchema)
  },
  libraryList: {
    channel: 'library.list',
    request: emptyRequestSchema,
    response: z.array(librarySkillSummarySchema)
  },
  libraryScan: {
    channel: 'library.scan',
    request: emptyRequestSchema,
    response: libraryScanResultSchema
  },
  workspaceState: {
    channel: 'workspace.state',
    request: emptyRequestSchema,
    response: desktopWorkspaceStateSchema
  },
  importLocalFolder: {
    channel: 'import.localFolder',
    request: z.object({ folderPath: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  importGit: {
    channel: 'import.git',
    request: z.object({ gitUrl: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  importZip: {
    channel: 'import.zip',
    request: z.object({ zipPath: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  importTar: {
    channel: 'import.tar',
    request: z.object({ tarPath: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  importGitSparse: {
    channel: 'import.gitSparse',
    request: z.object({ gitUrl: z.string().min(1), subpath: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  importMirror: {
    channel: 'import.mirror',
    request: z.object({ mirrorDirectory: z.string().min(1) }).strict(),
    response: importedSkillResultSchema
  },
  collectionCreate: {
    channel: 'collection.create',
    request: z.object({ name: z.string().min(1), description: z.string(), skillIds: z.array(z.string().min(1)) }).strict(),
    response: collectionRecordSchema
  },
  librarySearch: {
    channel: 'library.search',
    request: z
      .object({
        query: z.string(),
        favoritesOnly: z.boolean().optional(),
        mode: z.enum(['fts', 'semantic', 'hybrid']).optional(),
        filters: librarySearchFiltersSchema.optional()
      })
      .strict(),
    response: z.array(skillSummarySchema)
  },
  libraryFacets: {
    channel: 'library.facets',
    request: z.object({ filters: librarySearchFiltersSchema.optional() }).strict(),
    response: libraryFacetsSchema
  },
  librarySetFavorite: {
    channel: 'library.setFavorite',
    request: z.object({ skillId: z.string().min(1), favorite: z.boolean() }).strict(),
    response: skillSummarySchema
  },
  libraryDetail: {
    channel: 'library.detail',
    request: skillIdRequestSchema,
    response: skillDetailSchema
  },
  installCreatePlan: {
    channel: 'install.createPlan',
    request: z
      .object({
        skillId: z.string().min(1),
        targetRoot: z.string().min(1),
        agentCode: z.string().min(1),
        agentDisplayName: z.string().min(1),
        adapterVersion: z.string().min(1),
        scope: z.string().min(1),
        rootKind: rootKindSchema.optional(),
        projectionMode: projectionModeSchema
      })
      .strict(),
    response: installPlanSchema
  },
  installApplyPlan: {
    channel: 'install.applyPlan',
    request: z.object({ plan: installPlanSchema, confirmOverwrite: z.boolean() }).strict(),
    response: installResultSchema
  },
  installUninstall: {
    channel: 'install.uninstall',
    request: z.object({ installationId: z.string().min(1) }).strict(),
    response: z.object({ status: z.literal('uninstalled'), installationId: z.string().min(1) }).strict()
  },
  versionList: {
    channel: 'version.list',
    request: skillIdRequestSchema,
    response: z.array(skillVersionSummarySchema)
  },
  versionDiff: {
    channel: 'version.diff',
    request: z.object({ fromVersionId: z.string().min(1), toVersionId: z.string().min(1) }).strict(),
    response: z.array(fileDiffSchema)
  },
  versionCompare: {
    channel: 'version.compare',
    request: z.object({ fromVersionId: z.string().min(1), toVersionId: z.string().min(1) }).strict(),
    response: versionComparisonReportSchema
  },
  syncStartupPlan: {
    channel: 'sync.startupPlan',
    request: emptyRequestSchema,
    response: syncStartupPlanSchema
  },
  syncCreateProfile: {
    channel: 'sync.createProfile',
    request: z
      .object({
        mode: syncModeSchema,
        remoteUrl: z.string().min(1),
        enabled: z.boolean(),
        authRef: z.string().min(1).nullable().optional(),
        auth: z.object({ label: z.string().min(1), token: z.string().min(1) }).strict().optional()
      })
      .strict(),
    response: syncProfileSchema
  },
  syncInspectCredential: {
    channel: 'sync.inspectCredential',
    request: z.object({ authRef: z.string().min(1) }).strict(),
    response: z.object({ authRef: z.string().min(1), label: z.string().min(1), masked: z.string().min(1) }).strict().nullable()
  },
  syncDeleteCredential: {
    channel: 'sync.deleteCredential',
    request: z.object({ authRef: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  syncEnqueueLocalChange: {
    channel: 'sync.enqueueLocalChange',
    request: z.object({ profileId: z.string().min(1), entityType: z.string().min(1), entityId: z.string().min(1), payload: z.unknown() }).strict(),
    response: syncOutboxRecordSchema
  },
  syncPush: {
    channel: 'sync.push',
    request: z.object({ profileId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  syncPull: {
    channel: 'sync.pull',
    request: z.object({ profileId: z.string().min(1) }).strict(),
    response: z.array(syncInboxRecordSchema)
  },
  syncListConflicts: {
    channel: 'sync.listConflicts',
    request: z.object({ profileId: z.string().min(1).optional() }).strict(),
    response: z.array(syncConflictRecordSchema)
  },
  syncResolveConflict: {
    channel: 'sync.resolveConflict',
    request: z.object({ conflictId: z.string().min(1), resolution: z.string().min(1) }).strict(),
    response: syncConflictRecordSchema
  },
  syncApplyConflict: {
    channel: 'sync.applyConflict',
    request: z.object({ conflictId: z.string().min(1), confirm: z.boolean(), resolution: z.unknown() }).strict(),
    response: syncConflictRecordSchema.extend({ draftVersionIds: z.array(z.string().min(1)).optional() }).strict()
  },
  pluginsCenterState: {
    channel: 'plugins.centerState',
    request: emptyRequestSchema,
    response: pluginsStateSchema
  },
  pluginsInstall: {
    channel: 'plugins.install',
    request: z.object({ rootPath: z.string().min(1) }).strict(),
    response: pluginInstallResultSchema
  },
  pluginsAddDirectory: {
    channel: 'plugins.addDirectory',
    request: z.object({ rootPath: z.string().min(1) }).strict(),
    response: pluginDirectoryRecordSchema
  },
  pluginsListDirectories: {
    channel: 'plugins.listDirectories',
    request: emptyRequestSchema,
    response: z.array(pluginDirectoryRecordSchema)
  },
  pluginsScanDirectory: {
    channel: 'plugins.scanDirectory',
    request: z.object({ directoryId: z.string().min(1) }).strict(),
    response: pluginDirectoryScanResultSchema
  },
  pluginsRemoveDirectory: {
    channel: 'plugins.removeDirectory',
    request: z.object({ directoryId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  pluginsAuthorizePermission: {
    channel: 'plugins.authorizePermission',
    request: z.object({ pluginId: z.string().min(1), permission: pluginPermissionSchema, reason: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  pluginsEnable: {
    channel: 'plugins.enable',
    request: z.object({ pluginId: z.string().min(1) }).strict(),
    response: pluginRegistrySchema
  },
  pluginsDisable: {
    channel: 'plugins.disable',
    request: z.object({ pluginId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  pluginsRegistry: {
    channel: 'plugins.registry',
    request: emptyRequestSchema,
    response: pluginRegistrySchema
  },
  pluginsInvokeProvider: {
    channel: 'plugins.invokeProvider',
    request: z.object({ pluginId: z.string().min(1), capabilityType: pluginCapabilityTypeSchema, capabilityId: z.string().min(1), input: z.unknown() }).strict(),
    response: z.unknown()
  },
  settingsGet: {
    channel: 'settings.get',
    request: emptyRequestSchema,
    response: appSettingsSchema
  },
  settingsAddMirrorSource: {
    channel: 'settings.addMirrorSource',
    request: z.object({ name: z.string().min(1), url: z.string().min(1) }).strict(),
    response: mirrorSourceSettingSchema
  },
  settingsRemoveMirrorSource: {
    channel: 'settings.removeMirrorSource',
    request: z.object({ mirrorSourceId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  settingsSetUpdateChecks: {
    channel: 'settings.setUpdateChecks',
    request: z.object({ enabled: z.boolean() }).strict(),
    response: appSettingsSchema
  },
  settingsSetLogLevel: {
    channel: 'settings.setLogLevel',
    request: z.object({ logLevel: logLevelSchema }).strict(),
    response: appSettingsSchema
  },
  settingsAddPluginDirectory: {
    channel: 'settings.addPluginDirectory',
    request: z.object({ rootPath: z.string().min(1) }).strict(),
    response: pluginDirectoryRecordSchema
  },
  settingsListPluginDirectories: {
    channel: 'settings.listPluginDirectories',
    request: emptyRequestSchema,
    response: z.array(pluginDirectoryRecordSchema)
  },
  settingsRemovePluginDirectory: {
    channel: 'settings.removePluginDirectory',
    request: z.object({ directoryId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  discoverListSources: {
    channel: 'discover.listSources',
    request: emptyRequestSchema,
    response: z.array(discoverSourceSchema)
  },
  discoverAddSource: {
    channel: 'discover.addSource',
    request: z.object({ name: z.string().min(1), sourceType: z.enum(['local', 'git']), url: z.string().min(1) }).strict(),
    response: discoverSourceSchema
  },
  discoverPreviewSource: {
    channel: 'discover.previewSource',
    request: z.object({ sourceId: z.string().min(1) }).strict(),
    response: discoverPreviewResultSchema
  },
  discoverRemoveSource: {
    channel: 'discover.removeSource',
    request: z.object({ sourceId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  }
} as const;

export type IpcChannel = (typeof desktopShellContract)[keyof typeof desktopShellContract]['channel'];

type ContractEntry = (typeof desktopShellContract)[keyof typeof desktopShellContract];
type ContractForChannel<C extends IpcChannel> = Extract<ContractEntry, { channel: C }>;
type RequestForChannel<C extends IpcChannel> = z.infer<ContractForChannel<C>['request']>;
type ResponseForChannel<C extends IpcChannel> = z.infer<ContractForChannel<C>['response']>;

export function parseIpcRequest<C extends IpcChannel>(channel: C, payload: unknown): RequestForChannel<C>;
export function parseIpcRequest(channel: string, payload: unknown): unknown;
export function parseIpcRequest(channel: string, payload: unknown): unknown {
  const contract = findContract(channel);
  return contract.request.parse(payload);
}

export function parseIpcResponse<C extends IpcChannel>(channel: C, payload: unknown): ResponseForChannel<C>;
export function parseIpcResponse(channel: string, payload: unknown): unknown;
export function parseIpcResponse(channel: string, payload: unknown): unknown {
  const contract = findContract(channel);
  return contract.response.parse(payload);
}

function findContract(channel: string): ContractEntry {
  const contract = Object.values(desktopShellContract).find((entry) => entry.channel === channel);
  if (!contract) {
    throw new Error(`Unknown IPC channel: ${channel}`);
  }
  return contract;
}
