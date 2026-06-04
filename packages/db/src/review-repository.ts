import { createHash, randomUUID } from 'node:crypto';

import type { SqliteDatabase } from './migrations';

export interface UpsertReviewItemInput {
  itemType: string;
  subjectId: string;
  skillId?: string | null;
  skillName?: string | null;
  title: string;
  detail?: string;
  reason: string;
  source: string;
  reviewer: string;
  risk: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewItemSummary {
  id: string;
  title: string;
  detail: string;
  reason: string;
  source: string;
  reviewer: string;
  risk: string;
  status: string;
  skillName: string | null;
}

export interface ReviewCenterState {
  queue: ReviewItemSummary[];
  notes: Array<{ label: string; value: string }>;
}

export interface ReviewRepository {
  upsertReviewItem(input: UpsertReviewItemInput): ReviewItemSummary;
  updateReviewItemStatus(reviewItemId: string, status: string): void;
  addNote(input: { reviewItemId: string; note: string; status: string }): void;
  getReviewCenterState(): ReviewCenterState;
}

export function createReviewRepository(database: SqliteDatabase): ReviewRepository {
  return {
    upsertReviewItem(input) {
      const id = stableId('review', `${input.itemType}:${input.subjectId}`);
      database
        .prepare(
          `
            insert into review_items
              (
                id,
                item_type,
                subject_id,
                skill_id,
                skill_name,
                title,
                detail,
                reason,
                source,
                reviewer,
                risk,
                status,
                metadata_json
              )
            values
              (
                @id,
                @itemType,
                @subjectId,
                @skillId,
                @skillName,
                @title,
                @detail,
                @reason,
                @source,
                @reviewer,
                @risk,
                @status,
                @metadataJson
              )
            on conflict(item_type, subject_id) do update set
              skill_id = excluded.skill_id,
              skill_name = excluded.skill_name,
              title = excluded.title,
              detail = excluded.detail,
              reason = excluded.reason,
              source = excluded.source,
              reviewer = excluded.reviewer,
              risk = excluded.risk,
              status = excluded.status,
              metadata_json = excluded.metadata_json,
              updated_at = current_timestamp
          `
        )
        .run({
          id,
          itemType: input.itemType,
          subjectId: input.subjectId,
          skillId: input.skillId ?? null,
          skillName: input.skillName ?? null,
          title: input.title,
          detail: input.detail ?? '',
          reason: input.reason,
          source: input.source,
          reviewer: input.reviewer,
          risk: input.risk,
          status: input.status,
          metadataJson: JSON.stringify(input.metadata ?? {})
        });

      return getReviewItem(database, id);
    },

    updateReviewItemStatus(reviewItemId, status) {
      database
        .prepare('update review_items set status = @status, updated_at = current_timestamp where id = @id')
        .run({ id: reviewItemId, status });
    },

    addNote(input) {
      database
        .prepare(
          `
            insert into review_notes (id, review_item_id, note, status)
            values (@id, @reviewItemId, @note, @status)
          `
        )
        .run({
          id: randomUUID(),
          reviewItemId: input.reviewItemId,
          note: input.note,
          status: input.status
        });
    },

    getReviewCenterState() {
      return {
        queue: database
          .prepare(
            `
              select
                id,
                title,
                detail,
                reason,
                source,
                reviewer,
                risk,
                status,
                skill_name as skillName
              from review_items
              order by
                case status when 'Open' then 0 when 'Review' then 1 else 2 end,
                case risk when 'Critical' then 0 when 'High' then 1 when 'Medium' then 2 else 3 end,
                updated_at desc,
                title collate nocase
              limit 20
            `
          )
          .all()
          .map(reviewItemRow),
        notes: database
          .prepare(
            `
              select note as label, status as value
              from review_notes
              order by created_at desc, rowid desc
              limit 20
            `
          )
          .all()
          .map((row) => row as { label: string; value: string })
      };
    }
  };
}

function getReviewItem(database: SqliteDatabase, id: string): ReviewItemSummary {
  const row = database
    .prepare(
      `
        select
          id,
          title,
          detail,
          reason,
          source,
          reviewer,
          risk,
          status,
          skill_name as skillName
        from review_items
        where id = ?
      `
    )
    .get(id);

  if (!row) {
    throw new Error(`Review item not found: ${id}`);
  }

  return reviewItemRow(row);
}

function reviewItemRow(row: unknown): ReviewItemSummary {
  return row as ReviewItemSummary;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex')}`;
}
