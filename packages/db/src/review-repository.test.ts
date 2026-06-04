import { describe, expect, it } from 'vitest';

import { createMemoryDatabase, runMigrations } from './migrations';
import { createReviewRepository } from './review-repository';

describe('review repository', () => {
  it('upserts review items, records notes, and supports explicit status transitions', () => {
    const db = createMemoryDatabase();
    runMigrations(db);
    const reviews = createReviewRepository(db);

    const item = reviews.upsertReviewItem({
      itemType: 'security.finding',
      subjectId: 'finding-1',
      skillId: 'skill-1',
      skillName: 'Shell Helper',
      title: 'Shell Helper security review',
      detail: 'v1 security scan',
      reason: 'Dangerous shell command',
      source: 'Security scan',
      reviewer: 'Maintainer',
      risk: 'High',
      status: 'Open'
    });
    reviews.upsertReviewItem({
      itemType: 'security.finding',
      subjectId: 'finding-1',
      skillId: 'skill-1',
      skillName: 'Shell Helper',
      title: 'Shell Helper security review',
      detail: 'v1 security scan',
      reason: 'Dangerous shell command',
      source: 'Security scan',
      reviewer: 'Maintainer',
      risk: 'High',
      status: 'Open'
    });
    reviews.addNote({
      reviewItemId: item.id,
      note: 'Explain why shell access is required.',
      status: 'open'
    });

    expect(reviews.getReviewCenterState().queue).toHaveLength(1);
    expect(reviews.getReviewCenterState().queue[0]).toMatchObject({
      title: 'Shell Helper security review',
      risk: 'High',
      status: 'Open'
    });
    expect(reviews.getReviewCenterState().notes).toEqual([
      { label: 'Explain why shell access is required.', value: 'open' }
    ]);

    reviews.updateReviewItemStatus(item.id, 'Approved');

    expect(reviews.getReviewCenterState().queue[0]?.status).toBe('Approved');
  });
});
