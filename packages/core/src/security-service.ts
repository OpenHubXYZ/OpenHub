import { createHash, randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityLevel = 'safe' | SecuritySeverity;

export interface SecurityRule {
  id: string;
  name: string;
  category: string;
  severity: SecuritySeverity;
  scan(input: SecurityRuleScanInput): SecurityFindingDraft[];
}

export interface SecurityRuleScanInput {
  relativePath: string;
  content: string;
  size: number;
}

export interface SecurityFindingDraft {
  lineNo: number | null;
  excerpt: string;
}

export interface SecurityFinding {
  ruleId: string;
  ruleName: string;
  severity: SecuritySeverity;
  category: string;
  relativePath: string;
  lineNo: number | null;
  excerpt: string;
}

export interface SecurityScanResult {
  id: string;
  skillId: string;
  versionId: string;
  score: number;
  level: SecurityLevel;
  blocked: boolean;
  rulesetVersion: string;
  findings: SecurityFinding[];
}

export interface SecurityExemption {
  id: string;
  skillId: string;
  scope: string;
  reason: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface InstallPolicyResult {
  allowed: boolean;
  scan: SecurityScanResult;
  level: SecurityLevel;
  exemption: SecurityExemption | null;
}

export interface CreateSecurityServiceInput {
  database: SqliteDatabase;
  contentStore: ContentStore;
  rules?: SecurityRule[];
}

export interface SecurityService {
  scanSkill(input: { skillId: string }): Promise<SecurityScanResult>;
  batchRescan(input: { skillIds: string[] }): Promise<SecurityScanResult[]>;
  evaluateInstallPolicy(input: { skillId: string; scope: string }): Promise<InstallPolicyResult>;
  createExemption(input: { skillId: string; scope: string; reason: string }): SecurityExemption;
  revokeExemption(input: { exemptionId: string }): void;
}

interface SkillFileForScan {
  skillId: string;
  versionId: string;
  relativePath: string;
  blobHash: string;
  fileSize: number;
}

interface StoredScanRow {
  id: string;
  skillId: string;
  versionId: string;
  score: number;
  level: SecurityLevel;
  blocked: number;
  rulesetVersion: string;
}

const RULESET_VERSION = 'phase5-initial-v1';
const OVERSIZED_FILE_BYTES = 256 * 1024;

export function createSecurityService(input: CreateSecurityServiceInput): SecurityService {
  const rules = input.rules ?? defaultSecurityRules;

  return {
    async scanSkill({ skillId }) {
      const files = getLatestSkillFiles(input.database, skillId);
      if (files.length === 0) {
        throw new Error(`Skill has no files: ${skillId}`);
      }

      const findings: SecurityFinding[] = [];
      for (const file of files) {
        const content = (await input.contentStore.readBlob(file.blobHash)).toString('utf8');

        for (const rule of rules) {
          for (const finding of rule.scan({ relativePath: file.relativePath, content, size: file.fileSize })) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              category: rule.category,
              relativePath: file.relativePath,
              lineNo: finding.lineNo,
              excerpt: finding.excerpt
            });
          }
        }
      }

      const firstFile = first(files);
      return recordScan(input.database, {
        skillId,
        versionId: firstFile.versionId,
        findings,
        score: scoreFindings(findings),
        rulesetVersion: RULESET_VERSION
      });
    },

    async batchRescan({ skillIds }) {
      const results: SecurityScanResult[] = [];
      for (const skillId of skillIds) {
        results.push(await this.scanSkill({ skillId }));
      }

      return results;
    },

    async evaluateInstallPolicy({ skillId, scope }) {
      const files = getLatestSkillFiles(input.database, skillId);
      if (files.length === 0) {
        throw new Error(`Skill has no files: ${skillId}`);
      }

      const versionId = first(files).versionId;
      const scan = getStoredScan(input.database, skillId, versionId) ?? (await this.scanSkill({ skillId }));
      const exemption = getActiveExemption(input.database, skillId, scope);

      return {
        allowed: !scan.blocked || exemption !== null,
        scan,
        level: scan.level,
        exemption
      };
    },

    createExemption({ skillId, scope, reason }) {
      const id = randomUUID();
      input.database
        .prepare(
          `
            insert into security_exemptions (id, skill_id, scope, reason)
            values (@id, @skillId, @scope, @reason)
          `
        )
        .run({ id, skillId, scope, reason });

      return getExemption(input.database, id);
    },

    revokeExemption({ exemptionId }) {
      input.database
        .prepare('update security_exemptions set revoked_at = current_timestamp where id = ?')
        .run(exemptionId);
    }
  };
}

export const defaultSecurityRules: SecurityRule[] = [
  {
    id: 'dangerous-shell-command',
    name: 'Dangerous shell command',
    category: 'command',
    severity: 'critical',
    scan(input) {
      return findPattern(input.content, /\brm\s+-rf\b|curl\s+[^`\n|]+\|\s*(?:sh|bash)|wget\s+[^`\n|]+\|\s*(?:sh|bash)|\bsudo\b|\bchmod\s+777\b|\bdd\s+if=/i);
    }
  },
  {
    id: 'external-data-transfer',
    name: 'External data transfer',
    category: 'network',
    severity: 'medium',
    scan(input) {
      return findPattern(input.content, /\b(?:curl|wget)\s+https?:\/\/|fetch\(\s*['"]https?:\/\//i);
    }
  },
  {
    id: 'sensitive-file-read',
    name: 'Sensitive file read',
    category: 'privacy',
    severity: 'critical',
    scan(input) {
      return findPattern(input.content, /~\/\.ssh\/|id_rsa|\/etc\/passwd|\.env\b/i);
    }
  },
  {
    id: 'path-traversal',
    name: 'Path traversal reference',
    category: 'filesystem',
    severity: 'high',
    scan(input) {
      return findPattern(input.content, /\.\.\//);
    }
  },
  {
    id: 'executable-script',
    name: 'Executable script',
    category: 'execution',
    severity: 'medium',
    scan(input) {
      if (/\.(?:sh|bash|zsh|fish|ps1|bat|cmd)$/i.test(input.relativePath) || input.content.startsWith('#!')) {
        return [{ lineNo: 1, excerpt: excerptLine(input.content, 1) }];
      }

      return [];
    }
  },
  {
    id: 'oversized-file',
    name: 'Oversized file',
    category: 'resource',
    severity: 'low',
    scan(input) {
      if (input.size > OVERSIZED_FILE_BYTES) {
        return [{ lineNo: null, excerpt: `${input.relativePath} is ${input.size} bytes` }];
      }

      return [];
    }
  }
];

function recordScan(
  database: SqliteDatabase,
  input: {
    skillId: string;
    versionId: string;
    findings: SecurityFinding[];
    score: number;
    rulesetVersion: string;
  }
): SecurityScanResult {
  const level = levelForScore(input.score);
  const blocked = level === 'high' || level === 'critical';
  const scanId = stableId('security-scan', `${input.versionId}:${input.rulesetVersion}`);

  const write = database.transaction(() => {
    database
      .prepare(
        `
          insert into security_scans
            (id, skill_version_id, score, level, blocked, ruleset_version)
          values
            (@id, @versionId, @score, @level, @blocked, @rulesetVersion)
          on conflict(skill_version_id, ruleset_version) do update set
            score = excluded.score,
            level = excluded.level,
            blocked = excluded.blocked,
            scanned_at = current_timestamp
        `
      )
      .run({
        id: scanId,
        versionId: input.versionId,
        score: input.score,
        level,
        blocked: blocked ? 1 : 0,
        rulesetVersion: input.rulesetVersion
      });

    database.prepare('delete from security_findings where scan_id = ?').run(scanId);
    const insertFinding = database.prepare(
      `
        insert into security_findings
          (id, scan_id, rule_id, severity, category, relative_path, line_no, excerpt)
        values
          (@id, @scanId, @ruleId, @severity, @category, @relativePath, @lineNo, @excerpt)
      `
    );

    for (const finding of input.findings) {
      insertFinding.run({
        id: randomUUID(),
        scanId,
        ruleId: finding.ruleId,
        severity: finding.severity,
        category: finding.category,
        relativePath: finding.relativePath,
        lineNo: finding.lineNo,
        excerpt: finding.excerpt
      });
    }
  });

  write();

  return {
    id: scanId,
    skillId: input.skillId,
    versionId: input.versionId,
    score: input.score,
    level,
    blocked,
    rulesetVersion: input.rulesetVersion,
    findings: input.findings
  };
}

function getLatestSkillFiles(database: SqliteDatabase, skillId: string): SkillFileForScan[] {
  return database
    .prepare(
      `
        select
          s.id as skillId,
          sv.id as versionId,
          sf.relative_path as relativePath,
          sf.blob_hash as blobHash,
          sf.file_size as fileSize
        from skills s
        join skill_versions sv on sv.skill_id = s.id
        join skill_files sf on sf.skill_version_id = sv.id
        where s.id = @skillId
          and sv.version_no = (
            select max(version_no)
            from skill_versions
            where skill_id = @skillId
          )
        order by
          case when sf.relative_path = 'SKILL.md' then 0 else 1 end,
          sf.relative_path collate nocase
      `
    )
    .all({ skillId }) as SkillFileForScan[];
}

function getStoredScan(
  database: SqliteDatabase,
  skillId: string,
  versionId: string
): SecurityScanResult | null {
  const row = database
    .prepare(
      `
        select
          ss.id,
          sv.skill_id as skillId,
          ss.skill_version_id as versionId,
          ss.score,
          ss.level,
          ss.blocked,
          ss.ruleset_version as rulesetVersion
        from security_scans ss
        join skill_versions sv on sv.id = ss.skill_version_id
        where sv.skill_id = @skillId
          and ss.skill_version_id = @versionId
          and ss.ruleset_version = @rulesetVersion
      `
    )
    .get({ skillId, versionId, rulesetVersion: RULESET_VERSION });

  if (!row) {
    return null;
  }

  const scan = row as StoredScanRow;
  return {
    id: scan.id,
    skillId: scan.skillId,
    versionId: scan.versionId,
    score: scan.score,
    level: scan.level,
    blocked: scan.blocked === 1,
    rulesetVersion: scan.rulesetVersion,
    findings: getStoredFindings(database, scan.id)
  };
}

function getStoredFindings(database: SqliteDatabase, scanId: string): SecurityFinding[] {
  return database
    .prepare(
      `
        select
          sf.rule_id as ruleId,
          sf.severity,
          sf.category,
          sf.relative_path as relativePath,
          sf.line_no as lineNo,
          sf.excerpt
        from security_findings sf
        where sf.scan_id = ?
        order by sf.severity desc, sf.relative_path collate nocase
      `
    )
    .all(scanId)
    .map((row) => {
      const finding = row as Omit<SecurityFinding, 'ruleName'>;
      const rule = defaultSecurityRules.find((candidate) => candidate.id === finding.ruleId);
      return {
        ...finding,
        ruleName: rule?.name ?? finding.ruleId
      };
    });
}

function getActiveExemption(
  database: SqliteDatabase,
  skillId: string,
  scope: string
): SecurityExemption | null {
  const row = database
    .prepare(
      `
        select
          id,
          skill_id as skillId,
          scope,
          reason,
          created_at as createdAt,
          revoked_at as revokedAt
        from security_exemptions
        where skill_id = @skillId
          and scope = @scope
          and revoked_at is null
      `
    )
    .get({ skillId, scope });

  return row ? (row as SecurityExemption) : null;
}

function getExemption(database: SqliteDatabase, exemptionId: string): SecurityExemption {
  const row = database
    .prepare(
      `
        select
          id,
          skill_id as skillId,
          scope,
          reason,
          created_at as createdAt,
          revoked_at as revokedAt
        from security_exemptions
        where id = ?
      `
    )
    .get(exemptionId);

  if (!row) {
    throw new Error(`Security exemption not found: ${exemptionId}`);
  }

  return row as SecurityExemption;
}

function findPattern(content: string, pattern: RegExp): SecurityFindingDraft[] {
  const findings: SecurityFindingDraft[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      findings.push({
        lineNo: index + 1,
        excerpt: line.trim().slice(0, 180)
      });
    }
  });

  return findings;
}

function excerptLine(content: string, lineNo: number): string {
  return (content.split(/\r?\n/)[lineNo - 1] ?? '').trim().slice(0, 180);
}

function scoreFindings(findings: SecurityFinding[]): number {
  return Math.min(
    100,
    findings.reduce((score, finding) => score + severityScore(finding.severity), 0)
  );
}

function severityScore(severity: SecuritySeverity): number {
  if (severity === 'critical') {
    return 95;
  }

  if (severity === 'high') {
    return 75;
  }

  if (severity === 'medium') {
    return 45;
  }

  return 15;
}

function levelForScore(score: number): SecurityLevel {
  if (score >= 90) {
    return 'critical';
  }

  if (score >= 70) {
    return 'high';
  }

  if (score >= 40) {
    return 'medium';
  }

  if (score > 0) {
    return 'low';
  }

  return 'safe';
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}

function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) {
    throw new Error('Expected at least one item');
  }

  return item;
}
