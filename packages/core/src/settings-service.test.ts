import { createMemoryDatabase, runMigrations } from '@theopenhub/db';
import { describe, expect, it } from 'vitest';

import { createSettingsService } from './settings-service';

describe('settings service', () => {
  it('persists mirror sources, update preference, and log level with disabled update checks by default', () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const settings = createSettingsService({ database });

    expect(settings.getSettings()).toMatchObject({
      mirrorSources: [],
      updateChecksEnabled: false,
      logLevel: 'info'
    });
    const mirror = settings.addMirrorSource({ name: 'Local Mirror', url: '/tmp/mirror' });
    settings.setUpdateChecks({ enabled: true });
    settings.setLogLevel({ logLevel: 'debug' });
    expect(settings.getSettings()).toMatchObject({
      mirrorSources: [expect.objectContaining({ id: mirror.id, name: 'Local Mirror', url: '/tmp/mirror' })],
      updateChecksEnabled: true,
      logLevel: 'debug'
    });

    settings.removeMirrorSource({ mirrorSourceId: mirror.id });
    expect(settings.getSettings().mirrorSources).toEqual([]);
  });

  it('filters logs by persisted level and redacts secret-shaped values', () => {
    const database = createMemoryDatabase();
    runMigrations(database);
    const settings = createSettingsService({ database });
    settings.setLogLevel({ logLevel: 'warn' });

    expect(settings.filterLog({ level: 'info', message: 'token=super-secret-token' })).toBeNull();
    expect(settings.filterLog({ level: 'error', message: 'token=super-secret-token apiKey=abc123' })).toEqual({
      level: 'error',
      message: 'token=[redacted] apiKey=[redacted]'
    });
  });
});
