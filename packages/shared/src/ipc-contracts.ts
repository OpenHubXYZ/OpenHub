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
    installStatus: z.string().min(1)
  })
  .strict();

export type LibrarySkillSummary = z.infer<typeof librarySkillSummarySchema>;

export const skillSummarySchema = z
  .object({
    id: z.string().min(1),
    versionId: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    versionNo: z.number().int().positive()
  })
  .strict();

export type SkillSummary = z.infer<typeof skillSummarySchema>;

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
    conflictState: z.enum(['clean', 'conflict']),
    writes: z.array(installWriteSchema)
  })
  .strict();

export type InstallPlan = z.infer<typeof installPlanSchema>;

export const installResultSchema = z
  .object({
    status: z.literal('installed'),
    installationId: z.string().min(1),
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

const pluginsStateSchema = z
  .object({
    plugins: z.array(
      z
        .object({
          name: z.string().min(1),
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

export const appInfo: AppInfo = {
  productName: PRODUCT_NAME,
  phase: CURRENT_PHASE,
  localFirst: true
};

const emptyRequestSchema = z.object({}).strict();
const skillIdRequestSchema = z.object({ skillId: z.string().min(1) }).strict();

export const desktopShellContract = {
  appInfo: {
    channel: 'app.info',
    request: emptyRequestSchema,
    response: appInfoResponseSchema
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
  installCreatePlan: {
    channel: 'install.createPlan',
    request: z
      .object({
        skillId: z.string().min(1),
        targetRoot: z.string().min(1),
        agentCode: z.string().min(1),
        agentDisplayName: z.string().min(1),
        adapterVersion: z.string().min(1),
        scope: z.string().min(1)
      })
      .strict(),
    response: installPlanSchema
  },
  installApplyPlan: {
    channel: 'install.applyPlan',
    request: z.object({ plan: installPlanSchema }).strict(),
    response: installResultSchema
  },
  securityScan: {
    channel: 'security.scan',
    request: skillIdRequestSchema,
    response: securityScanResultSchema
  },
  syncStartupPlan: {
    channel: 'sync.startupPlan',
    request: emptyRequestSchema,
    response: syncStartupPlanSchema
  },
  pluginsCenterState: {
    channel: 'plugins.centerState',
    request: emptyRequestSchema,
    response: pluginsStateSchema
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
  channel: typeof desktopShellContract.installCreatePlan.channel,
  payload: unknown
): InstallPlan;
export function parseIpcResponse(
  channel: typeof desktopShellContract.installApplyPlan.channel,
  payload: unknown
): InstallResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.securityScan.channel,
  payload: unknown
): SecurityScanResult;
export function parseIpcResponse(
  channel: typeof desktopShellContract.syncStartupPlan.channel,
  payload: unknown
): SyncStartupPlan;
export function parseIpcResponse(
  channel: typeof desktopShellContract.pluginsCenterState.channel,
  payload: unknown
): PluginsState;
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
