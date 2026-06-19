import type { EvaluationModel, Evaluation, ChoicesDocument } from '../domain/types';

export interface DocMeta {
  id: string;
  label: string;
  updatedAt: string;
}

export interface DocsRepository {
  // Models (reusable templates)
  saveModel(model: EvaluationModel): Promise<void>;
  loadModel(id: string): Promise<EvaluationModel | null>;
  listModels(): Promise<DocMeta[]>;
  deleteModel(id: string): Promise<void>;
  exportModel(id: string): Promise<string>;

  // Evaluations (applications of a model to proposals)
  saveEvaluation(evaluation: Evaluation): Promise<void>;
  loadEvaluation(id: string): Promise<Evaluation | null>;
  listEvaluations(): Promise<DocMeta[]>;
  deleteEvaluation(id: string): Promise<void>;
  exportEvaluation(id: string): Promise<string>;

  /** Parse imported JSON into a model or an evaluation (discriminated by kind). */
  parseDocument(json: string): ChoicesDocument;
}
