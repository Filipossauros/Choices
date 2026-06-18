import type { MacbethModel } from '../domain/types';

export interface ModelRepository {
  saveModel(model: MacbethModel): Promise<void>;
  loadModel(id: string): Promise<MacbethModel | null>;
  listModels(): Promise<{ id: string; label: string; updatedAt: string }[]>;
  deleteModel(id: string): Promise<void>;
  exportModel(id: string): Promise<string>;
  importModel(json: string): Promise<MacbethModel>;
}
