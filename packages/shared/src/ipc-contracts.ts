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
    path: z.string().min(1),
    installStatus: z.string().min(1),
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
    riskStatuses: z.array(z.string().min(1)).optional(),
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
    risks: z.array(libraryFacetValueSchema),
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

const installWriteSchema = z
  .object({
    relativePath: z.string().min(1),
    targetPath: z.string().min(1),
    hash: z.string().min(1),
    size: z.number().int().nonnegative(),
    conflict: z.enum(['none', 'exists'])
  })
  .strict();

export const installPlanSchema = z
  .object({
    skillId: z.string().min(1),
    versionId: z.string().min(1),
    skillName: z.string().min(1),
    skillSlug: z.string().min(1),
    targetRoot: z.string().min(1),
    installPath: z.string().min(1),
    agentCode: z.string().min(1),
    agentDisplayName: z.string().min(1),
    adapterVersion: z.string().min(1),
    scope: z.string().min(1),
    rootKind: z.enum(['user', 'project']),
    projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']),
    conflictState: z.enum(['clean', 'conflict']),
    writes: z.array(installWriteSchema)
  })
  .strict();

export type InstallPlan = z.infer<typeof installPlanSchema>;

export const installResultSchema = z
  .object({
    status: z.enum(['installed', 'exported']),
    installationId: z.string().min(1).nullable(),
    targetRoot: z.string().min(1).optional(),
    security: z
      .object({
        level: z.string().min(1),
        warnings: z.array(
          z
            .object({
              ruleId: z.string().min(1),
              ruleName: z.string().min(1),
              severity: z.string().min(1),
              category: z.string().min(1),
              relativePath: z.string().min(1),
              lineNo: z.number().int().nullable(),
              excerpt: z.string()
            })
            .strict()
        )
      })
      .strict()
  })
  .strict();

export type InstallResult = z.infer<typeof installResultSchema>;

export const installCompatibilitySchema = z
  .object({
    status: z.enum(['compatible', 'incompatible']),
    skillId: z.string().min(1),
    versionId: z.string().min(1),
    agentCode: z.string().min(1),
    targetRoot: z.string().min(1),
    supportedAgents: z.array(z.string().min(1)),
    reasons: z.array(z.string().min(1))
  })
  .strict();

export type InstallCompatibility = z.infer<typeof installCompatibilitySchema>;

export const multiTargetInstallResultSchema = z
  .object({
    installed: z.array(installResultSchema),
    blocked: z.array(
      z
        .object({
          targetRoot: z.string().min(1),
          conflictState: z.enum(['clean', 'conflict']),
          reason: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type MultiTargetInstallResult = z.infer<typeof multiTargetInstallResultSchema>;

export const installLifecycleResultSchema = z
  .object({
    status: z.enum(['reinstalled', 'relinked']),
    installationId: z.string().min(1),
    targetRoot: z.string().min(1),
    projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']),
    compatibility: installCompatibilitySchema
  })
  .strict();

export type InstallLifecycleResult = z.infer<typeof installLifecycleResultSchema>;

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
    stagedFrom: z.string().min(1),
    signatureStatus: z.enum(['unsigned', 'signed', 'untrusted']).optional()
  })
  .strict();

export type ImportedSkillResult = z.infer<typeof importedSkillResultSchema>;

const managementFlowStateSchema = z
  .object({
    importItems: z.array(
      z
        .object({
          label: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    ),
    installPlan: z
      .object({
        skillName: z.string().min(1),
        targetRoot: z.string().min(1),
        conflictState: z.string().min(1),
        writeCount: z.number().int().nonnegative()
      })
      .strict()
      .nullable(),
    installResult: z
      .object({
        status: z.string().min(1),
        message: z.string().min(1)
      })
      .strict()
      .nullable()
  })
  .strict();

export type ManagementFlowState = z.infer<typeof managementFlowStateSchema>;

const securityCenterStateSchema = z
  .object({
    queue: z.array(
      z
        .object({
          skillName: z.string().min(1),
          status: z.string().min(1)
        })
        .strict()
    ),
    riskScore: z.number().int().nonnegative(),
    level: z.string().min(1),
    findings: z.array(
      z
        .object({
          ruleName: z.string().min(1),
          severity: z.string().min(1)
        })
        .strict()
    ),
    history: z.array(
      z
        .object({
          skillName: z.string().min(1),
          level: z.string().min(1)
        })
        .strict()
    ),
    exemptions: z.array(
      z
        .object({
          skillName: z.string().min(1),
          scope: z.string().min(1),
          reason: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type SecurityCenterState = z.infer<typeof securityCenterStateSchema>;

const usageCenterStateSchema = z
  .object({
    totals: z
      .object({
        launches: z.number().int().nonnegative(),
        installs: z.number().int().nonnegative(),
        scans: z.number().int().nonnegative(),
        exports: z.number().int().nonnegative()
      })
      .strict(),
    dailyActivity: z.array(
      z
        .object({
          date: z.string().min(1),
          count: z.number().int().nonnegative()
        })
        .strict()
    ),
    topSkills: z.array(
      z
        .object({
          skillName: z.string().min(1),
          count: z.number().int().nonnegative()
        })
        .strict()
    ),
    agentSplit: z.array(
      z
        .object({
          agent: z.string().min(1),
          count: z.number().int().nonnegative()
        })
        .strict()
    ),
    recent: z.array(
      z
        .object({
          eventType: z.string().min(1),
          label: z.string().min(1),
          value: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type UsageCenterState = z.infer<typeof usageCenterStateSchema>;

const reviewCenterStateSchema = z
  .object({
    queue: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string().min(1),
          detail: z.string(),
          reason: z.string().min(1),
          source: z.string().min(1),
          reviewer: z.string().min(1),
          risk: z.string().min(1),
          status: z.string().min(1),
          skillName: z.string().min(1).nullable()
        })
        .strict()
    ),
    notes: z.array(
      z
        .object({
          label: z.string().min(1),
          value: z.string().min(1)
        })
        .strict()
    )
  })
  .strict();

export type ReviewCenterState = z.infer<typeof reviewCenterStateSchema>;

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
    signatureStatus: z.enum(['unsigned', 'trusted', 'untrusted']),
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
          signatureStatus: z.enum(['unsigned', 'trusted', 'untrusted']).optional(),
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
    securityCenter: securityCenterStateSchema,
    usageCenter: usageCenterStateSchema,
    reviewCenter: reviewCenterStateSchema,
    governance: governanceStateSchema,
    syncCenter: syncCenterStateSchema,
    plugins: pluginsStateSchema
  })
  .strict();

export type DesktopWorkspaceState = z.infer<typeof desktopWorkspaceStateSchema>;

export const securityScanResultSchema = z
  .object({
    id: z.string().min(1),
    skillId: z.string().min(1),
    versionId: z.string().min(1),
    score: z.number().int().nonnegative(),
    level: z.string().min(1),
    blocked: z.boolean(),
    rulesetVersion: z.string().min(1),
    findings: installResultSchema.shape.security.shape.warnings
  })
  .strict();

export type SecurityScanResult = z.infer<typeof securityScanResultSchema>;

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

export const exportSkillResultSchema = z
  .object({
    outputDirectory: z.string().min(1)
  })
  .strict();

export type ExportSkillResult = z.infer<typeof exportSkillResultSchema>;

export const collectionRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string()
  })
  .strict();

export type CollectionRecord = z.infer<typeof collectionRecordSchema>;

export const collectionExportResultSchema = z
  .object({
    outputDirectory: z.string().min(1)
  })
  .strict();

export type CollectionExportResult = z.infer<typeof collectionExportResultSchema>;

export const collectionImportResultSchema = z
  .object({
    collection: collectionRecordSchema,
    skills: z.array(skillSummarySchema)
  })
  .strict();

export type CollectionImportResult = z.infer<typeof collectionImportResultSchema>;

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
    createdAt: z.string().min(1),
    lifecycle: z.enum(['draft', 'released']),
    releaseChannel: z.enum(['stable', 'beta', 'local'])
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

const versionFileInputSchema = z
  .object({
    relativePath: z.string().min(1),
    content: z.string()
  })
  .strict();

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
        url: z.string().nullable(),
        trustLevel: z.string().min(1)
      })
      .strict(),
    versions: z.array(skillVersionSummarySchema),
    files: z.array(skillFileSummarySchema),
    skillMarkdown: z.string(),
    latestScan: z
      .object({
        scanId: z.string().min(1),
        score: z.number().int().nonnegative(),
        level: z.string().min(1),
        blocked: z.boolean(),
        scannedAt: z.string().min(1)
      })
      .strict()
      .nullable(),
    installations: z.array(
      z
        .object({
          installationId: z.string().min(1),
          agent: z.string().min(1),
          rootPath: z.string().min(1),
          scope: z.string().min(1),
          installPath: z.string().min(1),
          status: z.string().min(1),
          projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']).optional(),
          readOnlyLocked: z.boolean().optional(),
          versionNo: z.number().int().positive()
        })
        .strict()
    ),
    riskStatus: z.string().min(1)
  })
  .strict();

export type SkillDetail = z.infer<typeof skillDetailSchema>;

const installTargetSchema = z
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

export type InstallTarget = z.infer<typeof installTargetSchema>;

export const installUninstallResultSchema = z
  .object({
    status: z.literal('uninstalled'),
    installationId: z.string().min(1)
  })
  .strict();

export type InstallUninstallResult = z.infer<typeof installUninstallResultSchema>;

export const installLockResultSchema = z
  .object({
    status: z.enum(['locked', 'unlocked']),
    installationId: z.string().min(1),
    readOnlyLocked: z.boolean()
  })
  .strict();

export type InstallLockResult = z.infer<typeof installLockResultSchema>;

export const versionRollbackResultSchema = z
  .object({
    status: z.literal('rolled_back'),
    installationId: z.string().min(1),
    versionId: z.string().min(1)
  })
  .strict();

export type VersionRollbackResult = z.infer<typeof versionRollbackResultSchema>;

const authorPreflightCheckSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(['pass', 'warning', 'block']),
    message: z.string().min(1)
  })
  .strict();

export const authorPreflightResultSchema = z
  .object({
    sourcePath: z.string().min(1),
    ok: z.boolean(),
    manifest: z
      .object({
        name: z.string().min(1),
        description: z.string(),
        tags: z.array(z.string())
      })
      .strict()
      .nullable(),
    checks: z.array(authorPreflightCheckSchema),
    findings: installResultSchema.shape.security.shape.warnings,
    signatureReady: z.boolean()
  })
  .strict();

export type AuthorPreflightResult = z.infer<typeof authorPreflightResultSchema>;

export const authorPackageResultSchema = z
  .object({
    outputDirectory: z.string().min(1),
    manifestPath: z.string().min(1),
    versionId: z.string().min(1).optional(),
    signatureStatus: z.enum(['unsigned', 'signed']),
    networkUpload: z.literal(false)
  })
  .strict();

export type AuthorPackageResult = z.infer<typeof authorPackageResultSchema>;

const securityFindingDetailSchema = z
  .object({
    skillName: z.string().min(1),
    scanId: z.string().min(1),
    ruleId: z.string().min(1),
    ruleName: z.string().min(1),
    severity: z.string().min(1),
    category: z.string().min(1),
    relativePath: z.string().min(1),
    lineNo: z.number().int().nullable(),
    excerpt: z.string()
  })
  .strict();

export type SecurityFindingDetail = z.infer<typeof securityFindingDetailSchema>;

const securityExemptionSchema = z
  .object({
    id: z.string().min(1),
    skillId: z.string().min(1),
    scope: z.string().min(1),
    reason: z.string().min(1),
    createdAt: z.string().min(1),
    revokedAt: z.string().nullable()
  })
  .strict();

export type SecurityExemption = z.infer<typeof securityExemptionSchema>;

export const securityRevokeExemptionResultSchema = z
  .object({
    status: z.literal('revoked'),
    exemptionId: z.string().min(1)
  })
  .strict();

export type SecurityRevokeExemptionResult = z.infer<typeof securityRevokeExemptionResultSchema>;

const syncModeSchema = z.enum(['shared-folder', 'git', 'rest', 'mock-rest']);

const syncProfileSchema = z
  .object({
    id: z.string().min(1),
    mode: syncModeSchema,
    remoteUrl: z.string().min(1),
    authRef: z.string().min(1).nullable(),
    enabled: z.boolean()
  })
  .strict();

export type SyncProfile = z.infer<typeof syncProfileSchema>;

const syncOutboxRecordSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    payload: z.unknown(),
    status: z.string().min(1)
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
    payload: z.unknown(),
    status: z.string().min(1)
  })
  .strict();

export type SyncInboxRecord = z.infer<typeof syncInboxRecordSchema>;

const syncConflictRecordSchema = z
  .object({
    id: z.string().min(1),
    profileId: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    base: z.unknown(),
    local: z.unknown(),
    remote: z.unknown(),
    status: z.enum(['open', 'resolved']),
    resolution: z.string().nullable()
  })
  .strict();

export type SyncConflictRecord = z.infer<typeof syncConflictRecordSchema>;

const policyScanLevelSchema = z.enum(['safe', 'warning', 'critical']);

export const policyPackSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    allowedSources: z.array(z.string().min(1)),
    blockedRules: z.array(z.string().min(1)),
    requiredScanLevel: policyScanLevelSchema,
    approvedPlugins: z.array(z.string().min(1))
  })
  .strict();

export type PolicyPack = z.infer<typeof policyPackSchema>;

export const policyEvaluationSchema = z
  .object({
    allowed: z.boolean(),
    reasons: z.array(z.string().min(1))
  })
  .strict();

export type PolicyEvaluation = z.infer<typeof policyEvaluationSchema>;

const baselineRootTemplateSchema = z
  .object({
    agentCode: z.string().min(1),
    scope: z.string().min(1),
    rootPathTemplate: z.string().min(1)
  })
  .strict();

export const baselinePreviewSchema = z
  .object({
    name: z.string().min(1),
    changes: z.array(z.string().min(1)),
    writesAgentRoots: z.literal(false)
  })
  .strict();

export type BaselinePreview = z.infer<typeof baselinePreviewSchema>;

export const baselineExportResultSchema = z
  .object({
    outputDirectory: z.string().min(1)
  })
  .strict();

export type BaselineExportResult = z.infer<typeof baselineExportResultSchema>;

const statusOnlyResultSchema = z
  .object({
    status: z.string().min(1)
  })
  .strict();

export type StatusOnlyResult = z.infer<typeof statusOnlyResultSchema>;

const pluginPermissionSchema = z.enum([
  'agent-root:read',
  'agent-root:write',
  'network:fetch',
  'import:local',
  'sync-driver',
  'export:local'
]);

const pluginCapabilityTypeSchema = z.enum(['agent-adapter', 'importer', 'security-rule', 'sync-driver', 'exporter']);

const pluginRegistrySchema = z
  .object({
    agentAdapters: z.array(
      z.object({ pluginId: z.string().min(1), code: z.string().min(1), displayName: z.string().min(1) }).strict()
    ),
    importers: z.array(
      z.object({ pluginId: z.string().min(1), id: z.string().min(1), name: z.string().min(1) }).strict()
    ),
    securityRules: z.array(
      z.object({ pluginId: z.string().min(1), id: z.string().min(1), name: z.string().min(1) }).strict()
    ),
    syncDrivers: z.array(
      z.object({ pluginId: z.string().min(1), id: z.string().min(1), name: z.string().min(1) }).strict()
    ),
    exporters: z.array(
      z.object({ pluginId: z.string().min(1), id: z.string().min(1), name: z.string().min(1) }).strict()
    )
  })
  .strict();

export type PluginRegistry = z.infer<typeof pluginRegistrySchema>;

const pluginInstallResultSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    status: z.string().min(1),
    rootPath: z.string().min(1),
    signatureStatus: z.enum(['unsigned', 'trusted', 'untrusted']).optional()
  })
  .strict();

export type PluginInstallResult = z.infer<typeof pluginInstallResultSchema>;

const discoverSourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    sourceType: z.enum(['local', 'git']),
    url: z.string().min(1),
    trustLevel: z.string().min(1),
    verified: z.boolean(),
    status: z.string().min(1),
    cachedAt: z.string().nullable()
  })
  .strict();

export type DiscoverSource = z.infer<typeof discoverSourceSchema>;

const discoverSkillPreviewSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    tags: z.array(z.string()),
    path: z.string().min(1),
    riskStatus: z.string().min(1),
    selected: z.boolean().optional(),
    importLabel: z.string().min(1).optional(),
    warnings: z.array(z.string().min(1)).optional()
  })
  .strict();

export type DiscoverSkillPreview = z.infer<typeof discoverSkillPreviewSchema>;

const discoverPreviewResultSchema = z
  .object({
    source: discoverSourceSchema,
    skills: z.array(discoverSkillPreviewSchema),
    writesPlanned: z.literal(false)
  })
  .strict();

export type DiscoverPreviewResult = z.infer<typeof discoverPreviewResultSchema>;

const migrationPreviewResultSchema = z
  .object({
    adapter: z.enum(['openskills', 'skills-manager', 'skillhub', 'skills-manager-client']),
    sourcePath: z.string().min(1),
    skills: z.array(discoverSkillPreviewSchema),
    writesPlanned: z.literal(false)
  })
  .strict();

export type MigrationPreviewResult = z.infer<typeof migrationPreviewResultSchema>;

const onboardingStateSchema = z
  .object({
    completed: z.boolean(),
    detectedRoots: z.array(installTargetSchema),
    migrationPreviews: z.array(migrationPreviewResultSchema)
  })
  .strict();

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const appInfo: AppInfo = {
  productName: PRODUCT_NAME,
  phase: CURRENT_PHASE,
  localFirst: true
};

const emptyRequestSchema = z.object({}).strict();
const skillIdRequestSchema = z.object({ skillId: z.string().min(1) }).strict();
const collectionIdRequestSchema = z.object({ collectionId: z.string().min(1) }).strict();
const librarySearchModeSchema = z.enum(['fts', 'semantic', 'hybrid']);
const installTargetRequestSchema = z
  .object({
    agentCode: z.enum(['codex', 'claude', 'gemini', 'opencode']),
    rootPath: z.string().min(1)
  })
  .strict();
const migrationImportItemSchema = z
  .object({
    path: z.string().min(1),
    selected: z.boolean().default(true),
    importLabel: z.string().min(1).optional()
  })
  .strict();

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
    request: z.object({ completed: z.boolean().default(true) }).strict(),
    response: onboardingStateSchema
  },
  onboardingImportMigration: {
    channel: 'onboarding.importMigration',
    request: z
      .object({
        adapter: z.enum(['openskills', 'skills-manager', 'skillhub', 'skills-manager-client']),
        sourcePath: z.string().min(1),
        paths: z.array(z.string().min(1)).min(1).optional(),
        items: z.array(migrationImportItemSchema).min(1).optional()
      })
      .strict()
      .refine((input) => input.paths || input.items, {
        message: 'Either paths or items is required'
      }),
    response: z.array(importedSkillResultSchema)
  },
  agentRootsAddProject: {
    channel: 'agentRoots.addProject',
    request: installTargetRequestSchema,
    response: installTargetSchema
  },
  agentRootsList: {
    channel: 'agentRoots.list',
    request: emptyRequestSchema,
    response: z.array(installTargetSchema)
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
  exportSkill: {
    channel: 'export.skill',
    request: z.object({ skillId: z.string().min(1), outputDirectory: z.string().min(1) }).strict(),
    response: exportSkillResultSchema
  },
  exportSignedSkill: {
    channel: 'export.signedSkill',
    request: z
      .object({
        skillId: z.string().min(1),
        outputDirectory: z.string().min(1),
        signer: z.string().min(1)
      })
      .strict(),
    response: exportSkillResultSchema
  },
  collectionCreate: {
    channel: 'collection.create',
    request: z
      .object({
        name: z.string().min(1),
        description: z.string(),
        skillIds: z.array(z.string().min(1))
      })
      .strict(),
    response: collectionRecordSchema
  },
  collectionExport: {
    channel: 'collection.export',
    request: collectionIdRequestSchema.extend({ outputDirectory: z.string().min(1) }).strict(),
    response: collectionExportResultSchema
  },
  collectionImport: {
    channel: 'collection.import',
    request: z.object({ packageDirectory: z.string().min(1) }).strict(),
    response: collectionImportResultSchema
  },
  librarySearch: {
    channel: 'library.search',
    request: z
      .object({
        query: z.string(),
        favoritesOnly: z.boolean().optional(),
        mode: librarySearchModeSchema.optional(),
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
        rootKind: z.enum(['user', 'project']).optional(),
        projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']).optional()
      })
      .strict(),
    response: installPlanSchema
  },
  installCheckCompatibility: {
    channel: 'install.checkCompatibility',
    request: z
      .object({
        skillId: z.string().min(1),
        targetRoot: z.string().min(1),
        agentCode: z.string().min(1),
        agentDisplayName: z.string().min(1),
        adapterVersion: z.string().min(1),
        scope: z.string().min(1),
        rootKind: z.enum(['user', 'project']).optional(),
        projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']).optional(),
        versionId: z.string().min(1).optional()
      })
      .strict(),
    response: installCompatibilitySchema
  },
  installCreateMultiTargetPlan: {
    channel: 'install.createMultiTargetPlan',
    request: z
      .object({
        skillId: z.string().min(1),
        projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']).optional(),
        targets: z.array(
          z
            .object({
              targetRoot: z.string().min(1).optional(),
              rootPath: z.string().min(1).optional(),
              agentCode: z.string().min(1),
              agentDisplayName: z.string().min(1),
              adapterVersion: z.string().min(1),
              scope: z.string().min(1),
              rootKind: z.enum(['user', 'project']).optional(),
              writable: z.boolean().optional(),
              isDefault: z.boolean().optional()
            })
            .strict()
            .refine((target) => target.targetRoot || target.rootPath, {
              message: 'Either targetRoot or rootPath is required'
            })
        )
      })
      .strict(),
    response: z.array(installPlanSchema)
  },
  installApplyPlan: {
    channel: 'install.applyPlan',
    request: z.object({ plan: installPlanSchema }).strict(),
    response: installResultSchema
  },
  installApplyMultiTargetPlan: {
    channel: 'install.applyMultiTargetPlan',
    request: z.object({ plans: z.array(installPlanSchema).min(1) }).strict(),
    response: multiTargetInstallResultSchema
  },
  installListTargets: {
    channel: 'install.listTargets',
    request: emptyRequestSchema,
    response: z.array(installTargetSchema)
  },
  installUninstall: {
    channel: 'install.uninstall',
    request: z.object({ installationId: z.string().min(1) }).strict(),
    response: installUninstallResultSchema
  },
  installReinstall: {
    channel: 'install.reinstall',
    request: z.object({ installationId: z.string().min(1) }).strict(),
    response: installLifecycleResultSchema
  },
  installRelink: {
    channel: 'install.relink',
    request: z
      .object({
        installationId: z.string().min(1),
        targetRoot: z.string().min(1),
        agentCode: z.string().min(1),
        agentDisplayName: z.string().min(1),
        adapterVersion: z.string().min(1),
        scope: z.string().min(1),
        rootKind: z.enum(['user', 'project']).optional(),
        projectionMode: z.enum(['copy', 'symlink', 'hardlink', 'mirror-export']).optional()
      })
      .strict(),
    response: installLifecycleResultSchema
  },
  installSetReadOnlyLock: {
    channel: 'install.setReadOnlyLock',
    request: z.object({ installationId: z.string().min(1), locked: z.boolean() }).strict(),
    response: installLockResultSchema
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
  versionCreateDraft: {
    channel: 'version.createDraft',
    request: z
      .object({
        skillId: z.string().min(1),
        changeSummary: z.string(),
        files: z.array(versionFileInputSchema).min(1)
      })
      .strict(),
    response: skillVersionSummarySchema
  },
  versionPromote: {
    channel: 'version.promote',
    request: z.object({ versionId: z.string().min(1), releaseChannel: z.enum(['beta', 'stable']) }).strict(),
    response: skillVersionSummarySchema
  },
  versionCompare: {
    channel: 'version.compare',
    request: z.object({ fromVersionId: z.string().min(1), toVersionId: z.string().min(1) }).strict(),
    response: versionComparisonReportSchema
  },
  versionRollback: {
    channel: 'version.rollback',
    request: z.object({ installationId: z.string().min(1), targetVersionId: z.string().min(1) }).strict(),
    response: versionRollbackResultSchema
  },
  authorOpenSourceFolder: {
    channel: 'author.openSourceFolder',
    request: z.object({ sourcePath: z.string().min(1) }).strict(),
    response: z.object({ status: z.literal('opened'), sourcePath: z.string().min(1) }).strict()
  },
  authorPreflight: {
    channel: 'author.preflight',
    request: z.object({ sourcePath: z.string().min(1), signer: z.string().optional() }).strict(),
    response: authorPreflightResultSchema
  },
  authorCreateDraftPackage: {
    channel: 'author.createDraftPackage',
    request: z
      .object({
        skillId: z.string().min(1),
        sourcePath: z.string().min(1),
        outputDirectory: z.string().min(1),
        changeSummary: z.string()
      })
      .strict(),
    response: authorPackageResultSchema
  },
  authorPreparePublishPackage: {
    channel: 'author.preparePublishPackage',
    request: z
      .object({
        skillId: z.string().min(1),
        sourcePath: z.string().min(1),
        outputDirectory: z.string().min(1),
        signer: z.string().min(1)
      })
      .strict(),
    response: authorPackageResultSchema
  },
  securityScan: {
    channel: 'security.scan',
    request: skillIdRequestSchema,
    response: securityScanResultSchema
  },
  securityRescan: {
    channel: 'security.rescan',
    request: z.object({ skillIds: z.array(z.string().min(1)).optional() }).strict(),
    response: z.array(securityScanResultSchema)
  },
  securityFindingDetail: {
    channel: 'security.findingDetail',
    request: z
      .object({
        scanId: z.string().min(1).optional(),
        skillId: z.string().min(1).optional(),
        ruleId: z.string().min(1).optional()
      })
      .strict(),
    response: securityFindingDetailSchema
  },
  securityCreateExemption: {
    channel: 'security.createExemption',
    request: z
      .object({
        skillId: z.string().min(1),
        scope: z.string().min(1),
        reason: z.string().min(1)
      })
      .strict(),
    response: securityExemptionSchema
  },
  securityRevokeExemption: {
    channel: 'security.revokeExemption',
    request: z.object({ exemptionId: z.string().min(1) }).strict(),
    response: securityRevokeExemptionResultSchema
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
        auth: z
          .object({
            label: z.string().min(1),
            token: z.string().min(1)
          })
          .strict()
          .optional()
      })
      .strict(),
    response: syncProfileSchema
  },
  syncInspectCredential: {
    channel: 'sync.inspectCredential',
    request: z.object({ authRef: z.string().min(1) }).strict(),
    response: z
      .object({
        authRef: z.string().min(1),
        label: z.string().min(1),
        masked: z.string().min(1)
      })
      .strict()
      .nullable()
  },
  syncDeleteCredential: {
    channel: 'sync.deleteCredential',
    request: z.object({ authRef: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  syncEnqueueLocalChange: {
    channel: 'sync.enqueueLocalChange',
    request: z
      .object({
        profileId: z.string().min(1),
        entityType: z.string().min(1),
        entityId: z.string().min(1),
        payload: z.unknown()
      })
      .strict(),
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
    request: z
      .object({
        conflictId: z.string().min(1),
        confirm: z.boolean(),
        resolution: z.unknown()
      })
      .strict(),
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
    request: z
      .object({
        pluginId: z.string().min(1),
        permission: pluginPermissionSchema,
        reason: z.string().min(1)
      })
      .strict(),
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
    request: z
      .object({
        pluginId: z.string().min(1),
        capabilityType: pluginCapabilityTypeSchema,
        capabilityId: z.string().min(1),
        input: z.unknown()
      })
      .strict(),
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
  policyCreate: {
    channel: 'policy.create',
    request: z
      .object({
        name: z.string().min(1),
        allowedSources: z.array(z.string().min(1)),
        blockedRules: z.array(z.string().min(1)),
        requiredScanLevel: policyScanLevelSchema,
        approvedPlugins: z.array(z.string().min(1))
      })
      .strict(),
    response: policyPackSchema
  },
  policyList: {
    channel: 'policy.list',
    request: emptyRequestSchema,
    response: z.array(policyPackSchema)
  },
  policySetActive: {
    channel: 'policy.setActive',
    request: z.object({ policyPackId: z.string().min(1) }).strict(),
    response: statusOnlyResultSchema
  },
  policyEvaluate: {
    channel: 'policy.evaluate',
    request: z
      .object({
        policyPackId: z.string().min(1),
        sourceType: z.string().min(1),
        findingRuleIds: z.array(z.string().min(1)),
        scanLevel: policyScanLevelSchema,
        pluginIds: z.array(z.string().min(1))
      })
      .strict(),
    response: policyEvaluationSchema
  },
  baselineExport: {
    channel: 'baseline.export',
    request: z
      .object({
        outputDirectory: z.string().min(1),
        name: z.string().min(1),
        collectionIds: z.array(z.string().min(1)),
        policyPackId: z.string().min(1),
        rootTemplates: z.array(baselineRootTemplateSchema)
      })
      .strict(),
    response: baselineExportResultSchema
  },
  baselinePreview: {
    channel: 'baseline.preview',
    request: z.object({ packageDirectory: z.string().min(1) }).strict(),
    response: baselinePreviewSchema
  },
  baselineApply: {
    channel: 'baseline.apply',
    request: z.object({ packageDirectory: z.string().min(1), confirm: z.boolean() }).strict(),
    response: baselinePreviewSchema
  },
  discoverAddSource: {
    channel: 'discover.addSource',
    request: z
      .object({
        name: z.string().min(1),
        sourceType: z.enum(['local', 'git']),
        url: z.string().min(1),
        trustLevel: z.string().min(1)
      })
      .strict(),
    response: discoverSourceSchema
  },
  discoverPreviewSource: {
    channel: 'discover.previewSource',
    request: z.object({ sourceId: z.string().min(1) }).strict(),
    response: discoverPreviewResultSchema
  },
  discoverMigrationPreview: {
    channel: 'discover.migrationPreview',
    request: z
      .object({
        adapter: z.enum(['openskills', 'skills-manager', 'skillhub', 'skills-manager-client']),
        sourcePath: z.string().min(1)
      })
      .strict(),
    response: migrationPreviewResultSchema
  }
} as const;

export type IpcChannel = (typeof desktopShellContract)[keyof typeof desktopShellContract]['channel'];

type ContractEntry = (typeof desktopShellContract)[keyof typeof desktopShellContract];

export function parseIpcRequest(channel: string, payload: unknown): unknown {
  const contract = contractForChannel(channel);
  if (!contract) {
    throw new Error(`Unknown IPC channel: ${channel}`);
  }

  return contract.request.parse(payload);
}

export function parseIpcResponse(
  channel: typeof desktopShellContract.appInfo.channel,
  payload: unknown
): AppInfo;
export function parseIpcResponse(
  channel: typeof desktopShellContract.onboardingState.channel,
  payload: unknown
): OnboardingState;
export function parseIpcResponse(
  channel: typeof desktopShellContract.onboardingComplete.channel,
  payload: unknown
): OnboardingState;
export function parseIpcResponse(
  channel: typeof desktopShellContract.onboardingImportMigration.channel,
  payload: unknown
): ImportedSkillResult[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.agentRootsAddProject.channel,
  payload: unknown
): InstallTarget;
export function parseIpcResponse(
  channel: typeof desktopShellContract.agentRootsList.channel,
  payload: unknown
): InstallTarget[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.libraryList.channel,
  payload: unknown
): LibrarySkillSummary[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.libraryScan.channel,
  payload: unknown
): LibraryScanResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.workspaceState.channel,
  payload: unknown
): DesktopWorkspaceState;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importLocalFolder.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importGit.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importZip.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importTar.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importGitSparse.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.importMirror.channel,
  payload: unknown
): ImportedSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.exportSkill.channel,
  payload: unknown
): ExportSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.exportSignedSkill.channel,
  payload: unknown
): ExportSkillResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.collectionCreate.channel,
  payload: unknown
): CollectionRecord;
export function parseIpcResponse(
  channel: typeof desktopShellContract.collectionExport.channel,
  payload: unknown
): CollectionExportResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.collectionImport.channel,
  payload: unknown
): CollectionImportResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.librarySearch.channel,
  payload: unknown
): SkillSummary[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.libraryFacets.channel,
  payload: unknown
): LibraryFacets;
export function parseIpcResponse(
  channel: typeof desktopShellContract.librarySetFavorite.channel,
  payload: unknown
): SkillSummary;
export function parseIpcResponse(
  channel: typeof desktopShellContract.libraryDetail.channel,
  payload: unknown
): SkillDetail;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installCreatePlan.channel,
  payload: unknown
): InstallPlan;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installCheckCompatibility.channel,
  payload: unknown
): InstallCompatibility;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installCreateMultiTargetPlan.channel,
  payload: unknown
): InstallPlan[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.installApplyPlan.channel,
  payload: unknown
): InstallResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installApplyMultiTargetPlan.channel,
  payload: unknown
): MultiTargetInstallResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installListTargets.channel,
  payload: unknown
): InstallTarget[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.installUninstall.channel,
  payload: unknown
): InstallUninstallResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installReinstall.channel,
  payload: unknown
): InstallLifecycleResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installRelink.channel,
  payload: unknown
): InstallLifecycleResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installSetReadOnlyLock.channel,
  payload: unknown
): InstallLockResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionList.channel,
  payload: unknown
): SkillVersionSummary[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionDiff.channel,
  payload: unknown
): FileDiff[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionCreateDraft.channel,
  payload: unknown
): SkillVersionSummary;
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionPromote.channel,
  payload: unknown
): SkillVersionSummary;
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionCompare.channel,
  payload: unknown
): VersionComparisonReport;
export function parseIpcResponse(
  channel: typeof desktopShellContract.versionRollback.channel,
  payload: unknown
): VersionRollbackResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.authorOpenSourceFolder.channel,
  payload: unknown
): { status: 'opened'; sourcePath: string };
export function parseIpcResponse(
  channel: typeof desktopShellContract.authorPreflight.channel,
  payload: unknown
): AuthorPreflightResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.authorCreateDraftPackage.channel,
  payload: unknown
): AuthorPackageResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.authorPreparePublishPackage.channel,
  payload: unknown
): AuthorPackageResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityScan.channel,
  payload: unknown
): SecurityScanResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityRescan.channel,
  payload: unknown
): SecurityScanResult[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityFindingDetail.channel,
  payload: unknown
): SecurityFindingDetail;
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityCreateExemption.channel,
  payload: unknown
): SecurityExemption;
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityRevokeExemption.channel,
  payload: unknown
): SecurityRevokeExemptionResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncStartupPlan.channel,
  payload: unknown
): SyncStartupPlan;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncCreateProfile.channel,
  payload: unknown
): SyncProfile;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncInspectCredential.channel,
  payload: unknown
): { authRef: string; label: string; masked: string } | null;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncDeleteCredential.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncEnqueueLocalChange.channel,
  payload: unknown
): SyncOutboxRecord;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncPush.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncPull.channel,
  payload: unknown
): SyncInboxRecord[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncListConflicts.channel,
  payload: unknown
): SyncConflictRecord[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncResolveConflict.channel,
  payload: unknown
): SyncConflictRecord;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncApplyConflict.channel,
  payload: unknown
): SyncConflictRecord & { draftVersionIds?: string[] };
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsCenterState.channel,
  payload: unknown
): PluginsState;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsInstall.channel,
  payload: unknown
): PluginInstallResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsAddDirectory.channel,
  payload: unknown
): PluginDirectoryRecord;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsListDirectories.channel,
  payload: unknown
): PluginDirectoryRecord[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsScanDirectory.channel,
  payload: unknown
): PluginDirectoryScanResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsRemoveDirectory.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsAuthorizePermission.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsEnable.channel,
  payload: unknown
): PluginRegistry;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsDisable.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsRegistry.channel,
  payload: unknown
): PluginRegistry;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsInvokeProvider.channel,
  payload: unknown
): unknown;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsGet.channel,
  payload: unknown
): AppSettings;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsAddMirrorSource.channel,
  payload: unknown
): AppSettings['mirrorSources'][number];
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsRemoveMirrorSource.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsSetUpdateChecks.channel,
  payload: unknown
): AppSettings;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsSetLogLevel.channel,
  payload: unknown
): AppSettings;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsAddPluginDirectory.channel,
  payload: unknown
): PluginDirectoryRecord;
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsListPluginDirectories.channel,
  payload: unknown
): PluginDirectoryRecord[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.settingsRemovePluginDirectory.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.policyCreate.channel,
  payload: unknown
): PolicyPack;
export function parseIpcResponse(
  channel: typeof desktopShellContract.policyList.channel,
  payload: unknown
): PolicyPack[];
export function parseIpcResponse(
  channel: typeof desktopShellContract.policySetActive.channel,
  payload: unknown
): StatusOnlyResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.policyEvaluate.channel,
  payload: unknown
): PolicyEvaluation;
export function parseIpcResponse(
  channel: typeof desktopShellContract.baselineExport.channel,
  payload: unknown
): BaselineExportResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.baselinePreview.channel,
  payload: unknown
): BaselinePreview;
export function parseIpcResponse(
  channel: typeof desktopShellContract.baselineApply.channel,
  payload: unknown
): BaselinePreview;
export function parseIpcResponse(
  channel: typeof desktopShellContract.discoverAddSource.channel,
  payload: unknown
): DiscoverSource;
export function parseIpcResponse(
  channel: typeof desktopShellContract.discoverPreviewSource.channel,
  payload: unknown
): DiscoverPreviewResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.discoverMigrationPreview.channel,
  payload: unknown
): MigrationPreviewResult;
export function parseIpcResponse(channel: string, payload: unknown): unknown {
  const contract = contractForChannel(channel);
  if (!contract) {
    throw new Error(`Unknown IPC channel: ${channel}`);
  }

  return contract.response.parse(payload);
}

function contractForChannel(channel: string): ContractEntry | undefined {
  return Object.values(desktopShellContract).find((contract) => contract.channel === channel);
}
