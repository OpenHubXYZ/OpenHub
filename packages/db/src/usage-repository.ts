import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export interface RecordUsageEventInput {
  eventType: string;
  skillId?: string | null;
  skillName?: string | null;
  agentCode?: string | null;
  agentDisplayName?: string | null;
  subject: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface UsageCenterState {
  totals: {
    launches: number;
    installs: number;
    scans: number;
    exports: number;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  topSkills: Array<{ skillName: string; count: number }>;
  agentSplit: Array<{ agent: string; count: number }>;
  recent: Array<{ eventType: string; label: string; value: string }>;
}

export interface UsageRepository {
  recordEvent(input: RecordUsageEventInput): void;
  getUsageCenterState(): UsageCenterState;
}

export function createUsageRepository(database: SqliteDatabase): UsageRepository {
  return {
    recordEvent(input) {
      database
        .prepare(
          `
            insert into usage_events
              (id, event_type, skill_id, skill_name, agent_code, agent_display_name, subject, metadata_json, occurred_at)
            values
              (@id, @eventType, @skillId, @skillName, @agentCode, @agentDisplayName, @subject, @metadataJson, @occurredAt)
          `
        )
        .run({
          id: randomUUID(),
          eventType: input.eventType,
          skillId: input.skillId ?? null,
          skillName: input.skillName ?? null,
          agentCode: input.agentCode ?? null,
          agentDisplayName: input.agentDisplayName ?? null,
          subject: input.subject,
          metadataJson: JSON.stringify(input.metadata ?? {}),
          occurredAt: input.occurredAt ?? new Date().toISOString()
        });
    },

    getUsageCenterState() {
      return {
        totals: {
          launches: countEvents(database, ['skill.launch']),
          installs: countEvents(database, ['install.plan', 'install.apply']),
          scans: countEvents(database, ['agent.scan', 'security.scan']),
          exports: countEvents(database, ['export.package'])
        },
        dailyActivity: database
          .prepare(
            `
              select date(occurred_at) as date, count(*) as count
              from usage_events
              group by date(occurred_at)
              order by date(occurred_at)
              limit 30
            `
          )
          .all()
          .map((row) => row as { date: string; count: number }),
        topSkills: database
          .prepare(
            `
              select skill_name as skillName, count(*) as count
              from usage_events
              where skill_name is not null
              group by skill_name
              order by count(*) desc, skill_name collate nocase
              limit 8
            `
          )
          .all()
          .map((row) => row as { skillName: string; count: number }),
        agentSplit: database
          .prepare(
            `
              select agent_display_name as agent, count(*) as count
              from usage_events
              where agent_display_name is not null
              group by agent_display_name
              order by count(*) desc, agent_display_name collate nocase
              limit 8
            `
          )
          .all()
          .map((row) => row as { agent: string; count: number }),
        recent: database
          .prepare(
            `
              select event_type as eventType, subject as label, occurred_at as value
              from usage_events
              order by occurred_at desc, rowid desc
              limit 8
            `
          )
          .all()
          .map((row) => row as { eventType: string; label: string; value: string })
      };
    }
  };
}

function countEvents(database: SqliteDatabase, eventTypes: string[]): number {
  const placeholders = eventTypes.map(() => '?').join(', ');
  const row = database
    .prepare(`select count(*) as count from usage_events where event_type in (${placeholders})`)
    .get(...eventTypes) as { count: number };
  return row.count;
}
