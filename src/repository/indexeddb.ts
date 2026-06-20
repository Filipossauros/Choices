import { openDB, type IDBPDatabase } from 'idb';
import type { EvaluationModel, Evaluation, ChoicesDocument } from '../domain/types';
import { MODEL_VERSION } from '../domain/types';
import type { DocsRepository, DocMeta } from './types';

const DB_NAME = 'macbeth-arc';
const DB_VERSION = 2;
const MODELS = 'models';
const EVALUATIONS = 'evaluations';

async function openChoicesDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(MODELS)) {
        db.createObjectStore(MODELS, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(EVALUATIONS)) {
        db.createObjectStore(EVALUATIONS, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
    },
  });
}

/** Coerce a possibly-legacy (v1) record into a current EvaluationModel. */
export function normalizeModel(raw: Record<string, unknown>): EvaluationModel {
  const legacy = raw as {
    approvedThreshold?: number;
    conditionalThreshold?: number;
    decisionScale?: EvaluationModel['decisionScale'];
  };
  let decisionScale = legacy.decisionScale;
  if (!decisionScale || decisionScale.length === 0) {
    // Build a 3-band scale from the old two thresholds if present.
    const approved = legacy.approvedThreshold ?? 70;
    const conditional = legacy.conditionalThreshold ?? 40;
    decisionScale = [
      { id: 'b-approved', label: 'Recomendado', minScore: approved, color: '#16a34a' },
      { id: 'b-conditional', label: 'Recomendado com reservas', minScore: conditional, color: '#d97706' },
      { id: 'b-rejected', label: 'Não recomendado', minScore: 0, color: '#dc2626' },
    ];
  }
  const r = raw as Partial<EvaluationModel>;
  return {
    kind: 'model',
    id: (r.id as string) ?? crypto.randomUUID(),
    modelVersion: MODEL_VERSION,
    label: r.label ?? 'Modelo',
    description: r.description,
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? new Date().toISOString(),
    valueTree: r.valueTree ?? { root: { criterionId: 'root', children: [] }, criteria: {} },
    judgmentMatrices: r.judgmentMatrices ?? [],
    derivedScales: r.derivedScales ?? [],
    weights: r.weights,
    subWeights: r.subWeights,
    decisionScale,
  };
}

export class IndexedDBRepository implements DocsRepository {
  private db: IDBPDatabase | null = null;

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) this.db = await openChoicesDB();
    return this.db;
  }

  // ── Models ──────────────────────────────────────────────────────────────
  async saveModel(model: EvaluationModel): Promise<void> {
    const db = await this.getDB();
    await db.put(MODELS, { ...model, kind: 'model', updatedAt: new Date().toISOString() });
  }

  async loadModel(id: string): Promise<EvaluationModel | null> {
    const db = await this.getDB();
    const raw = await db.get(MODELS, id);
    return raw ? normalizeModel(raw) : null;
  }

  async listModels(): Promise<DocMeta[]> {
    const db = await this.getDB();
    const all = (await db.getAll(MODELS)) as EvaluationModel[];
    return all
      .map((m) => ({ id: m.id, label: m.label, updatedAt: m.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteModel(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(MODELS, id);
  }

  async exportModel(id: string): Promise<string> {
    const model = await this.loadModel(id);
    if (!model) throw new Error(`Model ${id} not found`);
    return JSON.stringify(model, null, 2);
  }

  // ── Evaluations ─────────────────────────────────────────────────────────
  async saveEvaluation(evaluation: Evaluation): Promise<void> {
    const db = await this.getDB();
    await db.put(EVALUATIONS, { ...evaluation, kind: 'evaluation', updatedAt: new Date().toISOString() });
  }

  async loadEvaluation(id: string): Promise<Evaluation | null> {
    const db = await this.getDB();
    return (await db.get(EVALUATIONS, id)) ?? null;
  }

  async listEvaluations(): Promise<DocMeta[]> {
    const db = await this.getDB();
    const all = (await db.getAll(EVALUATIONS)) as Evaluation[];
    return all
      .map((e) => ({ id: e.id, label: e.label, updatedAt: e.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteEvaluation(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(EVALUATIONS, id);
  }

  async exportEvaluation(id: string): Promise<string> {
    const evaluation = await this.loadEvaluation(id);
    if (!evaluation) throw new Error(`Evaluation ${id} not found`);
    return JSON.stringify(evaluation, null, 2);
  }

  // ── Import ────────────────────────────────────────────────────────────────
  parseDocument(json: string): ChoicesDocument {
    const obj = JSON.parse(json) as Record<string, unknown>;
    if (obj.kind === 'evaluation' || (obj.model != null && obj.options != null)) {
      return obj as unknown as Evaluation;
    }
    return normalizeModel(obj);
  }
}

export const repository = new IndexedDBRepository();
