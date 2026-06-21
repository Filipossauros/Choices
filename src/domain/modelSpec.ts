/**
 * Machine-readable specifications of a model and of the application itself.
 *
 * These are produced for *AI agents*: a complete, self-contained description of
 * a decision model (criteria, formulas, weights, scales, decision bands) so an
 * agent can reason about it and run diagnostics, plus a capabilities manifest
 * describing what the application does and how its data is shaped.
 */

import type { EvaluationModel } from './types';
import { ROOT_ID } from './types';
import {
  weightingGroups,
  weightsForGroup,
  effectiveWeights,
  findNode,
  parentOf,
} from './tree';

export const MODEL_SPEC_SCHEMA = 'choices/model-spec@1';
export const MANIFEST_SCHEMA = 'choices/capabilities@1';

// ─── Model spec ──────────────────────────────────────────────────────────────

export interface GroupFormula {
  /** The node this formula computes (e.g. "V(p)" for root, "V[HealthStatus]"). */
  target: string;
  /** Expanded additive expression, e.g. "0.40·V[HealthStatus] + 0.60·v[Criticidade]". */
  expression: string;
}

export interface SpecCriterion {
  id: string;
  label: string;
  type: 'composite' | 'qualification' | 'gate';
  description?: string;
  parent: string;
  children?: string[];
  /** Effective (global) weight = product of group weights to the root. */
  effectiveWeight?: number;
  /** Weight within its own group (sums to 1 across siblings). */
  groupWeight?: number;
  levels?: { id: string; label: string; value?: number; anchor?: 'neutral' | 'good' }[];
  veto?: string;
  continuous?: boolean;
}

export interface ModelSpec {
  schema: typeof MODEL_SPEC_SCHEMA;
  generatedAt: string;
  model: { id: string; label: string; description?: string; version: string };
  method: {
    name: 'MACBETH';
    reference: 'Bana e Costa & Vansnick, 1994';
    aggregation: 'additive';
    anchors: { neutral: 0; good: 100 };
    valueRange: [0, 100];
  };
  formula: {
    global: string;
    perGroup: GroupFormula[];
    notes: string[];
  };
  criteria: SpecCriterion[];
  weighting: {
    groups: { id: string; label: string; weights: { criterionId: string; label: string; weight: number }[]; consistencyMargin?: number }[];
    effectiveLeafWeights: { criterionId: string; label: string; weight: number }[];
  };
  decision: { bands: { label: string; action?: string; minScore: number; thresholdSource: 'profile' | 'manual'; referenceProfile?: Record<string, string> }[] };
  diagnostics: {
    leafCount: number;
    factorCount: number;
    gateCount: number;
    scalesDerived: boolean;
    weightsComplete: boolean;
    ready: boolean;
  };
}

function symFor(model: EvaluationModel, id: string): string {
  const c = model.valueTree.criteria[id];
  const label = c?.label ?? id;
  return c?.type === 'composite' ? `V[${label}]` : `v[${label}]`;
}

export function buildModelSpec(model: EvaluationModel): ModelSpec {
  const { criteria } = model.valueTree;
  const allCrit = Object.values(criteria);
  const groups = weightingGroups(model).filter((g) => g.childIds.length > 0);
  const effW = effectiveWeights(model);
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s]));

  // Per-group additive formulas (root + each composite).
  const perGroup: GroupFormula[] = groups.map((g) => {
    const w = weightsForGroup(model, g.parentId);
    const single = g.childIds.length === 1;
    const terms = g.childIds.map((id) => {
      const weight = single ? 1 : w?.weights.find((x) => x.criterionId === id)?.weight;
      const coef = weight != null ? weight.toFixed(2) : 'k';
      return `${coef}·${symFor(model, id)}`;
    });
    const target = g.parentId === ROOT_ID ? 'V(p)' : symFor(model, g.parentId);
    return { target, expression: terms.join(' + ') || '—' };
  });

  // Flat criteria descriptions.
  const specCriteria: SpecCriterion[] = allCrit.map((c) => {
    const parent = parentOf(model.valueTree, c.id) ?? ROOT_ID;
    const base: SpecCriterion = { id: c.id, label: c.label, type: c.type, description: c.description, parent };
    if (c.type === 'composite') {
      base.children = findNode(model.valueTree, c.id)?.children.map((ch) => ch.criterionId) ?? [];
    }
    if (c.type === 'qualification') {
      const scale = scaleMap.get(c.id);
      base.effectiveWeight = effW.get(c.id);
      base.continuous = c.continuous;
      base.veto = c.vetoLevelId
        ? c.descriptor.levels.find((l) => l.id === c.vetoLevelId)?.label
        : undefined;
      base.levels = c.descriptor.levels.map((l, i) => ({
        id: l.id,
        label: l.label,
        value: scale?.values.find((v) => v.levelId === l.id)?.value,
        anchor:
          i === c.descriptor.neutralIndex ? 'neutral' : i === c.descriptor.goodIndex ? 'good' : undefined,
      }));
    }
    return base;
  });

  const weightingGroupsOut = groups.map((g) => {
    const w = weightsForGroup(model, g.parentId);
    const single = g.childIds.length === 1;
    return {
      id: g.parentId,
      label: g.parentId === ROOT_ID ? 'Fatores de topo' : criteria[g.parentId]?.label ?? g.parentId,
      consistencyMargin: w?.consistencyMargin,
      weights: g.childIds.map((id) => ({
        criterionId: id,
        label: criteria[id]?.label ?? id,
        weight: single ? 1 : w?.weights.find((x) => x.criterionId === id)?.weight ?? 0,
      })),
    };
  });

  const leafCount = allCrit.filter((c) => c.type === 'qualification').length;
  const gateCount = allCrit.filter((c) => c.type === 'gate').length;
  const factorCount = allCrit.filter((c) => c.type === 'composite').length;
  const scalesDerived = allCrit
    .filter((c) => c.type === 'qualification')
    .every((c) => scaleMap.get(c.id) && scaleMap.get(c.id)!.consistencyMargin > 0);
  const weightsComplete = groups.every((g) => {
    if (g.childIds.length <= 1) return true;
    const w = weightsForGroup(model, g.parentId);
    return !!w && w.consistencyMargin > 0;
  });

  return {
    schema: MODEL_SPEC_SCHEMA,
    generatedAt: new Date().toISOString(),
    model: { id: model.id, label: model.label, description: model.description, version: model.modelVersion },
    method: {
      name: 'MACBETH',
      reference: 'Bana e Costa & Vansnick, 1994',
      aggregation: 'additive',
      anchors: { neutral: 0, good: 100 },
      valueRange: [0, 100],
    },
    formula: {
      global: 'V(p) = Σᵢ kᵢ · vᵢ(p)',
      perGroup,
      notes: [
        'Modelo aditivo ponderado sobre uma árvore de critérios.',
        'Cada fator composto V[F] é a média ponderada dos seus filhos; o peso de cada grupo soma 1.',
        'O peso efetivo (global) de uma folha é o produto dos pesos ao longo do caminho até à raiz.',
        'Âncoras: vᵢ(Neutro) = 0, vᵢ(Bom) = 100. Portas (gate) são eliminatórias e não entram em V(p).',
      ],
    },
    criteria: specCriteria,
    weighting: {
      groups: weightingGroupsOut,
      effectiveLeafWeights: [...effW.entries()].map(([criterionId, weight]) => ({
        criterionId,
        label: criteria[criterionId]?.label ?? criterionId,
        weight,
      })),
    },
    decision: {
      bands: [...model.decisionScale]
        .sort((a, b) => b.minScore - a.minScore)
        .map((b) => ({
          label: b.label,
          action: b.action,
          minScore: b.minScore,
          thresholdSource: (b.referenceProfile ? 'profile' : 'manual') as 'profile' | 'manual',
          referenceProfile: b.referenceProfile,
        })),
    },
    diagnostics: {
      leafCount,
      factorCount,
      gateCount,
      scalesDerived,
      weightsComplete,
      ready: leafCount > 0 && scalesDerived && weightsComplete,
    },
  };
}

// ─── Capabilities manifest ───────────────────────────────────────────────────

export interface CapabilitiesManifest {
  schema: typeof MANIFEST_SCHEMA;
  name: 'Choices';
  tagline: string;
  purpose: string;
  method: { name: string; description: string; reference: string };
  entities: { name: string; kind: string; description: string }[];
  flows: { id: string; name: string; steps: string[]; description: string }[];
  criterionTypes: { type: string; description: string }[];
  capabilities: string[];
  exports: { id: string; description: string; schema?: string }[];
  exampleUseCases: { name: string; description: string; structure: string }[];
}

export function buildCapabilitiesManifest(): CapabilitiesManifest {
  return {
    schema: MANIFEST_SCHEMA,
    name: 'Choices',
    tagline: 'Avaliação Multicritério de Alternativas',
    purpose:
      'Aplicação web local-first para construir modelos de decisão multicritério pelo método MACBETH e aplicá-los para avaliar e classificar alternativas, com critérios hierárquicos (fatores e subfatores).',
    method: {
      name: 'MACBETH',
      description:
        'Measuring Attractiveness by a Categorical Based Evaluation Technique. Usa juízos qualitativos de diferença de atratividade (Nula→Extrema) entre pares para derivar escalas cardinais de valor e pesos por programação linear.',
      reference: 'Bana e Costa & Vansnick, 1994',
    },
    entities: [
      { name: 'EvaluationModel', kind: 'model', description: 'Modelo reutilizável: árvore de critérios, escalas de valor, pesos por grupo e perfis de decisão. Não depende de propostas concretas.' },
      { name: 'Evaluation', kind: 'evaluation', description: 'Aplicação de um modelo a propostas concretas; embute um snapshot do modelo, os desempenhos e o resultado agregado.' },
    ],
    flows: [
      {
        id: 'create',
        name: 'Criação do modelo',
        steps: ['Critérios', 'Escalas', 'Ponderação', 'Perfis de decisão', 'Resumo'],
        description: 'Estruturar a árvore de critérios, derivar escalas cardinais, ponderar cada grupo e definir os limiares de decisão.',
      },
      {
        id: 'apply',
        name: 'Aplicação do modelo',
        steps: ['Análise e avaliação', 'Resultados', 'Sensibilidade', 'Relatório'],
        description: 'Registar propostas, classificar o seu desempenho, agregar para obter V(p), analisar robustez e exportar relatório.',
      },
    ],
    criterionTypes: [
      { type: 'composite', description: 'Fator interno que agrega os seus subcritérios por ponderação (multinível).' },
      { type: 'qualification', description: 'Folha com descritor de níveis ordenados; produz um valor cardinal vᵢ(p) ∈ [0,100].' },
      { type: 'gate', description: 'Porta binária eliminatória (cumpre/não cumpre); uma falha reprova a proposta antes da agregação.' },
    ],
    capabilities: [
      'Critérios hierárquicos com fatores e subfatores e agregação aditiva multinível.',
      'Derivação de escalas cardinais de valor por MACBETH com verificação de consistência (LP) e sugestões de correção.',
      'Ponderação por oscilação (swing weighting) independente por cada grupo de irmãos.',
      'Perfis de decisão com limiares derivados de perfis de referência (impacto global).',
      'Desempenhos discretos ou contínuos (curva monótona-cúbica PCHIP).',
      'Habilitação por portas e veto por critério.',
      'Resultados explicáveis: painel «Porquê» com contribuições por fator, pontos fortes/fracos e alavancas de melhoria para subir de perfil de decisão.',
      'Análise de sensibilidade dos pesos (um critério de cada vez) com deteção e localização das mudanças de ordenação.',
      'Exportação de modelo, avaliação, decisão, especificação para IA (JSON), relatório (PDF) e resultados (CSV).',
      'Persistência local (IndexedDB) e importação/exportação JSON.',
      'Interface local-first em PT-PT, domínio-agnóstica, com modo claro e escuro (dark mode).',
    ],
    exports: [
      { id: 'model-json', description: 'Modelo completo, reimportável.', schema: 'EvaluationModel' },
      { id: 'evaluation-json', description: 'Avaliação completa (modelo + propostas + resultados).', schema: 'Evaluation' },
      { id: 'model-spec-json', description: 'Especificação legível por IA do modelo (fórmulas, pesos, escalas, diagnósticos).', schema: MODEL_SPEC_SCHEMA },
      { id: 'report-pdf', description: 'Relatório de decisão em PDF.' },
    ],
    exampleUseCases: [
      {
        name: 'Avaliação de arquiteturas de SI',
        description: 'Avaliar propostas de arquitetura por fatores como segurança, interoperabilidade, escalabilidade e justificação tecnológica.',
        structure: 'root → {Segurança→{Autenticação, Cifra, RGPD(porta)}, Interoperabilidade, Escolhas tecnológicas}; perfis: Aprovado/Com reservas/Rejeitado.',
      },
      {
        name: 'Monitorização e risco de plataforma',
        description: 'Compor um fator HealthStatus a partir de métricas técnicas e um fator Risco que o pondera com criticidade, duração e responsabilidade.',
        structure: 'root(Risco) → {HealthStatus→{Latência, Taxa de erros, Saturação}, Criticidade, Duração, Responsabilidade}; perfis: Nenhuma ação/Advertência/Sanção.',
      },
    ],
  };
}

// ─── Download helper ─────────────────────────────────────────────────────────

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
