import { describe, expect, it } from 'vitest';

import { createMemoryDatabase, runMigrations } from './migrations';
import { createUsageRepository } from './usage-repository';

describe('usage repository', () => {
  it('records local-only usage events and summarizes usage center state', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const usage = createUsageRepository(db);

    usage.recordEvent({
      eventType: 'skill.import',
      skillId: 'skill-1',
      skillName: 'Runtime Helper',
      subject: 'Imported Runtime Helper',
      occurredAt: '2026-06-01T09:00:00.000Z'
    });
    usage.recordEvent({
      eventType: 'install.apply',
      skillId: 'skill-1',
      skillName: 'Runtime Helper',
      agentCode: 'codex',
      agentDisplayName: 'Codex',
      subject: 'Installed Runtime Helper to Codex',
      occurredAt: '2026-06-01T10:00:00.000Z'
    });
    usage.recordEvent({
      eventType: 'security.scan',
      skillId: 'skill-1',
      skillName: 'Runtime Helper',
      subject: 'Security scanned Runtime Helper',
      occurredAt: '2026-06-02T11:00:00.000Z'
    });

    const state = usage.getUsageCenterState();

    expect(state.totals).toEqual({
      launches: 0,
      installs: 1,
      scans: 1,
      exports: 0
    });
    expect(state.dailyActivity).toEqual([
      { date: '2026-06-01', count: 2 },
      { date: '2026-06-02', count: 1 }
    ]);
    expect(state.topSkills).toEqual([{ skillName: 'Runtime Helper', count: 3 }]);
    expect(state.agentSplit).toEqual([{ agent: 'Codex', count: 1 }]);
    expect(state.recent[0]).toMatchObject({
      eventType: 'security.scan',
      label: 'Security scanned Runtime Helper'
    });
  });
});
