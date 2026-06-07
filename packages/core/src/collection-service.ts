import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '@theopenhub/db';

import type { ContentStore } from './content-store';

export interface CreateCollectionServiceInput {
  database: SqliteDatabase;
  contentStore?: ContentStore;
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string;
}

export interface CreateCollectionInput {
  name: string;
  description: string;
  skillIds: string[];
}

export interface CollectionService {
  createCollection(input: CreateCollectionInput): CollectionRecord;
}

export function createCollectionService(input: CreateCollectionServiceInput): CollectionService {
  return {
    createCollection(collection) {
      return createCollectionRecord(input.database, collection);
    }
  };
}

function createCollectionRecord(
  database: SqliteDatabase,
  input: CreateCollectionInput
): CollectionRecord {
  const id = randomUUID();
  const create = database.transaction(() => {
    database
      .prepare('insert into collections (id, name, description) values (?, ?, ?)')
      .run(id, input.name, input.description);

    const insertItem = database.prepare('insert into collection_items (collection_id, skill_id) values (?, ?)');
    for (const skillId of input.skillIds) {
      insertItem.run(id, skillId);
    }
  });

  create();
  return { id, name: input.name, description: input.description };
}
