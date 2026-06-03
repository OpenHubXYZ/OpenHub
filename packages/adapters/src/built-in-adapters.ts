import { constants } from 'node:fs';
import { access, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { AgentAdapter, AgentCode, InstalledSkillLocation } from './agent-adapter';

interface BuiltInAdapterConfig {
  id: AgentCode;
  displayName: string;
  relativeRoot: string;
}

export interface BuiltInAdapterOptions {
  homeDirectory?: string;
  adapterVersion?: string;
}

const builtInConfigs: BuiltInAdapterConfig[] = [
  { id: 'codex', displayName: 'Codex', relativeRoot: '.codex/skills' },
  { id: 'claude', displayName: 'Claude', relativeRoot: '.claude/skills' },
  { id: 'gemini', displayName: 'Gemini', relativeRoot: '.gemini/skills' },
  { id: 'opencode', displayName: 'OpenCode', relativeRoot: '.opencode/skills' }
];

export function createBuiltInAgentAdapters(options: BuiltInAdapterOptions = {}): AgentAdapter[] {
  const homeDirectory = options.homeDirectory ?? homedir();
  const adapterVersion = options.adapterVersion ?? '0.0.0';

  return builtInConfigs.map((config) => ({
    id: config.id,
    displayName: config.displayName,
    adapterVersion,

    async detectRoots() {
      const rootPath = path.join(homeDirectory, config.relativeRoot);
      if (!(await directoryExists(rootPath))) {
        return [];
      }

      return [
        {
          agentCode: config.id,
          agentDisplayName: config.displayName,
          adapterVersion,
          rootPath,
          scope: 'user' as const,
          writable: await canWrite(rootPath),
          isDefault: true
        }
      ];
    },

    async listInstalled(root) {
      const entries = await readdir(root.rootPath, { withFileTypes: true });
      const installed: InstalledSkillLocation[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillPath = path.join(root.rootPath, entry.name);
        const manifestPath = path.join(skillPath, 'SKILL.md');
        if (await fileExists(manifestPath)) {
          installed.push({
            agentCode: config.id,
            rootPath: root.rootPath,
            skillPath,
            manifestPath
          });
        }
      }

      return installed.sort((left, right) => left.skillPath.localeCompare(right.skillPath));
    },

    async install() {
      return phaseFourOnly();
    },

    async uninstall() {
      return phaseFourOnly();
    },

    async verify() {
      return phaseFourOnly();
    }
  }));
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function canWrite(directoryPath: string): Promise<boolean> {
  try {
    await access(directoryPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function phaseFourOnly() {
  return {
    status: 'unsupported' as const,
    message: 'Install, uninstall, and verify operations are implemented in Phase 4.'
  };
}
