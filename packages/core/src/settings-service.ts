import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '@theopenhub/db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface MirrorSourceSetting {
  id: string;
  name: string;
  url: string;
}

export interface RuntimeSettings {
  mirrorSources: MirrorSourceSetting[];
  updateChecksEnabled: boolean;
  logLevel: LogLevel;
}

export interface RedactedLogRecord {
  level: LogLevel;
  message: string;
}

export interface SettingsService {
  getSettings(): RuntimeSettings;
  addMirrorSource(input: { name: string; url: string }): MirrorSourceSetting;
  removeMirrorSource(input: { mirrorSourceId: string }): { status: 'removed' };
  setUpdateChecks(input: { enabled: boolean }): RuntimeSettings;
  setLogLevel(input: { logLevel: LogLevel }): RuntimeSettings;
  filterLog(input: { level: LogLevel; message: string }): RedactedLogRecord | null;
}

export function createSettingsService(input: { database: SqliteDatabase }): SettingsService {
  return {
    getSettings() {
      return readSettings(input.database);
    },

    addMirrorSource({ name, url }) {
      const settings = readSettings(input.database);
      const mirror = { id: randomUUID(), name, url };
      writeSetting(input.database, 'settings.mirrorSources', [...settings.mirrorSources, mirror]);
      return mirror;
    },

    removeMirrorSource({ mirrorSourceId }) {
      const settings = readSettings(input.database);
      writeSetting(
        input.database,
        'settings.mirrorSources',
        settings.mirrorSources.filter((mirror) => mirror.id !== mirrorSourceId)
      );
      return { status: 'removed' };
    },

    setUpdateChecks({ enabled }) {
      writeSetting(input.database, 'settings.updateChecksEnabled', enabled);
      return readSettings(input.database);
    },

    setLogLevel({ logLevel }) {
      writeSetting(input.database, 'settings.logLevel', logLevel);
      return readSettings(input.database);
    },

    filterLog({ level, message }) {
      const currentLevel = readSettings(input.database).logLevel;
      if (levelPriority(level) < levelPriority(currentLevel)) {
        return null;
      }

      return {
        level,
        message: redactSecrets(message)
      };
    }
  };
}

function readSettings(database: SqliteDatabase): RuntimeSettings {
  return {
    mirrorSources: readSetting<MirrorSourceSetting[]>(database, 'settings.mirrorSources') ?? [],
    updateChecksEnabled: readSetting<boolean>(database, 'settings.updateChecksEnabled') ?? false,
    logLevel: readSetting<LogLevel>(database, 'settings.logLevel') ?? 'info'
  };
}

function readSetting<T>(database: SqliteDatabase, key: string): T | null {
  const row = database.prepare('select value_json as valueJson from app_settings where key = ?').get(key) as
    | { valueJson: string }
    | undefined;
  return row ? (JSON.parse(row.valueJson) as T) : null;
}

function writeSetting(database: SqliteDatabase, key: string, value: unknown): void {
  database
    .prepare(
      `
        insert into app_settings (key, value_json, updated_at)
        values (@key, @valueJson, current_timestamp)
        on conflict(key) do update set
          value_json = excluded.value_json,
          updated_at = current_timestamp
      `
    )
    .run({ key, valueJson: JSON.stringify(value) });
}

function levelPriority(level: LogLevel): number {
  return { debug: 10, info: 20, warn: 30, error: 40 }[level];
}

function redactSecrets(message: string): string {
  return message
    .replace(/\b(token|apiKey|password|secret)=\S+/gi, '$1=[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}
