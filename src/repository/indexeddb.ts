import { openDB, type IDBPDatabase } from 'idb';
import type { MacbethModel } from '../domain/types';
import type { ModelRepository } from './types';

const DB_NAME = 'macbeth-arc';
const DB_VERSION = 1;
const STORE = 'models';

async function openMacbethDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    },
  });
}

export class IndexedDBRepository implements ModelRepository {
  private db: IDBPDatabase | null = null;

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) this.db = await openMacbethDB();
    return this.db;
  }

  async saveModel(model: MacbethModel): Promise<void> {
    const db = await this.getDB();
    await db.put(STORE, { ...model, updatedAt: new Date().toISOString() });
  }

  async loadModel(id: string): Promise<MacbethModel | null> {
    const db = await this.getDB();
    return (await db.get(STORE, id)) ?? null;
  }

  async listModels(): Promise<{ id: string; label: string; updatedAt: string }[]> {
    const db = await this.getDB();
    const all = (await db.getAll(STORE)) as MacbethModel[];
    return all
      .map((m) => ({ id: m.id, label: m.label, updatedAt: m.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteModel(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE, id);
  }

  async exportModel(id: string): Promise<string> {
    const model = await this.loadModel(id);
    if (!model) throw new Error(`Model ${id} not found`);
    return JSON.stringify(model, null, 2);
  }

  async importModel(json: string): Promise<MacbethModel> {
    const model = JSON.parse(json) as MacbethModel;
    await this.saveModel(model);
    return model;
  }
}

export const repository = new IndexedDBRepository();
