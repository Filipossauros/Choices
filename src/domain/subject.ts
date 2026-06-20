/**
 * Domain-neutral noun for what a model evaluates. A model marked `positions`
 * (monitoring moments) reads "posição"; otherwise "proposta". Centralised so the
 * apply-flow copy (Analysis, Results, Sensitivity, Report) stays consistent.
 */
export interface SubjectNoun {
  one: string;
  many: string;
  One: string;
  Many: string;
}

export function subjectNoun(model: { subjectKind?: 'proposals' | 'positions' }): SubjectNoun {
  return model.subjectKind === 'positions'
    ? { one: 'posição', many: 'posições', One: 'Posição', Many: 'Posições' }
    : { one: 'proposta', many: 'propostas', One: 'Proposta', Many: 'Propostas' };
}
