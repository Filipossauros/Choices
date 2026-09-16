import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import type { MacbethJudgment, JudgmentMatrix } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID, ROOT_ID } from '../../domain/types';
import { deriveWeights, ALL_NEUTRAL } from '../../engine/weighting';
import { simulateWeighting, judgmentsFromWeights } from '../../engine/simulate';
import WeightSliders, { weightReadings, type WeightMap } from '../components/WeightSliders';
import { IconGrip } from '../components/icons';
import { weightingGroups, weightsForGroup, setGroupWeights, groupConsistent, groupEffectiveWeight, type Group } from '../../domain/tree';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import GuidedJudgments from '../components/GuidedJudgments';
import ScreenNav from '../components/ScreenNav';
import { v4 as uuidv4 } from 'uuid';

/** One collapsible weighting panel for a single group of sibling criteria. */
function GroupPanel({ group, open, onToggle }: { group: Group; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [deriving, setDeriving] = useState(false);
  const [activePairKey, setActivePairKey] = useState<string | null>(null);
  // Judgments seeded by ROC stay flagged until the user reviews them.
  const [simulated, setSimulated] = useState(false);
  // Direct-weight mode: a second input surface writing the same judgments.
  const [directMode, setDirectMode] = useState(false);
  const [draft, setDraft] = useState<WeightMap>({});

  const { criteria } = model.valueTree;
  const childCrits = group.childIds.map((id) => criteria[id]).filter(Boolean);
  const single = group.childIds.length === 1;
  const consistent = groupConsistent(model, group);
  const weights = weightsForGroup(model, group.parentId);

  // Weighting matrix for THIS group — keyed by parent id in criterionId.
  const matrix: JudgmentMatrix =
    model.judgmentMatrices.find((m) => m.kind === 'weighting' && (m.criterionId ?? ROOT_ID) === group.parentId) ?? {
      id: uuidv4(),
      kind: 'weighting',
      criterionId: group.parentId,
      assessorId: DEFAULT_ASSESSOR_ID,
      judgments: {},
      updatedAt: new Date().toISOString(),
    };

  /**
   * The concrete before→after a swing actually means. Naming the two levels
   * turns an abstract "Neutro to Bom" into something the assessor can picture,
   * which is the whole difficulty with swing weighting.
   */
  function jumpOf(id: string): string {
    const c = criteria[id];
    if (c?.type !== 'qualification') return '';
    const { levels, neutralIndex, goodIndex } = c.descriptor;
    const from = levels[neutralIndex]?.label;
    const to = levels[goodIndex]?.label;
    return from && to ? `${from} → ${to}` : '';
  }

  /**
   * Seed every judgment in this group from the importance ranking alone, via
   * Rank Order Centroid. Marked as suggested until reviewed: a simulated weight
   * is not an elicited preference, and the audit trail has to keep them apart.
   */
  function simulate() {
    const { judgments } = simulateWeighting(orderedChildIds);
    if (
      Object.keys(matrix.judgments).length > 0 &&
      !confirm(t('Isto substitui as respostas já dadas neste grupo por juízos simulados a partir da ordem de importância. Continuar?'))
    ) return;
    updateJudgments(judgments);
    setSimulated(true);
  }

  function updateJudgments(judgments: Record<string, MacbethJudgment>) {
    const updated: JudgmentMatrix = { ...matrix, judgments, updatedAt: new Date().toISOString() };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        judgmentMatrices: [
          ...model.judgmentMatrices.filter(
            (m) => !(m.kind === 'weighting' && (m.criterionId ?? ROOT_ID) === group.parentId),
          ),
          updated,
        ],
      },
    });
  }

  // Criteria ordered most→least valuable swing. Uses the saved ranking when
  // present (filtered to live ids, with any new criteria appended), else the
  // value-tree order.
  const orderedChildIds = (() => {
    const ids = childCrits.map((c) => c.id);
    const saved = model.weightOrder?.[group.parentId];
    if (!saved) return ids;
    const inSaved = saved.filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !inSaved.includes(id));
    return [...inSaved, ...missing];
  })();

  function moveCriterion(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= orderedChildIds.length) return;
    const next = [...orderedChildIds];
    [next[i], next[j]] = [next[j], next[i]];

    // Re-key the existing judgments to the new order so already-given answers
    // stay in the matrix (the magnitude is symmetric; only which side is the
    // "more attractive" row changes). ALL_NEUTRAL always ranks last.
    const rank = new Map(next.map((id, k) => [id, k] as const));
    const rankOf = (id: string) => (id === ALL_NEUTRAL ? Number.MAX_SAFE_INTEGER : rank.get(id) ?? Number.MAX_SAFE_INTEGER - 1);
    const remapped: Record<string, MacbethJudgment> = {};
    for (const [key, value] of Object.entries(matrix.judgments)) {
      const [a, b] = key.split('__');
      const [first, second] = rankOf(a) <= rankOf(b) ? [a, b] : [b, a];
      remapped[`${first}__${second}`] = value;
    }

    const updatedMatrix: JudgmentMatrix = { ...matrix, judgments: remapped, updatedAt: new Date().toISOString() };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        weightOrder: { ...(model.weightOrder ?? {}), [group.parentId]: next },
        judgmentMatrices: [
          ...model.judgmentMatrices.filter(
            (m) => !(m.kind === 'weighting' && (m.criterionId ?? ROOT_ID) === group.parentId),
          ),
          updatedMatrix,
        ],
      },
    });
  }

  function openDirect() {
    const seed: WeightMap = {};
    const n = orderedChildIds.length || 1;
    for (const id of orderedChildIds) {
      seed[id] = weights?.weights.find((w) => w.criterionId === id)?.weight ?? 1 / n;
    }
    setDraft(seed);
    setDirectMode(true);
  }

  /** Dragged weights become judgments; the LP still derives the final numbers. */
  async function applyDirect() {
    updateJudgments(judgmentsFromWeights(orderedChildIds, draft));
    setDirectMode(false);
    setSimulated(true);
    const w = await deriveWeights(orderedChildIds, judgmentsFromWeights(orderedChildIds, draft));
    dispatch({ type: 'UPDATE_MODEL', patch: setGroupWeights(model, group.parentId, w) });
  }

  async function handleDerive() {
    setDeriving(true);
    try {
      const w = await deriveWeights(orderedChildIds, matrix.judgments);
      dispatch({ type: 'UPDATE_MODEL', patch: setGroupWeights(model, group.parentId, w) });
    } finally {
      setDeriving(false);
    }
  }

  const matrixItems = [
    ...orderedChildIds.map((id) => ({ id, label: criteria[id]?.label ?? id })),
    { id: ALL_NEUTRAL, label: t('Tudo-Neutro (ref.)') },
  ];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
        <span className="text-gray-400 text-xs w-3">{open ? '▾' : '▸'}</span>
        <span className="font-medium text-gray-800">
          {group.parentId === ROOT_ID ? t('Pesos dos fatores de topo') : t('Pesos dentro de «{{label}}»', { label: group.label })}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1">{childCrits.map((c) => c.label).join(' · ')}</span>
        {single ? (
          <span className="text-xs text-gray-400">{t('único (100%)')}</span>
        ) : consistent ? (
          <span className="text-xs font-semibold text-green-600">✓ {weights ? `z = ${weights.consistencyMargin.toFixed(3)}` : t('ok')}</span>
        ) : (
          <span className="text-xs font-semibold text-gray-400">{t('por calcular')}</span>
        )}
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-gray-100">
          {single ? (
            <p className="text-sm text-gray-500">
              {t('Este grupo tem um único critério ponderável — recebe 100% do peso dentro do grupo. Sem comparações a fazer.')}
            </p>
          ) : directMode ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-gray-500 flex-1 min-w-[16rem] leading-relaxed">
                  <strong className="text-gray-700">{t('Continua a ser o mesmo método.')}</strong>{' '}
                  {t('Arraste os pesos e veja, ao vivo, que juízos MACBETH isso implica. A soma mantém-se sempre em 1.00.')}
                </p>
                <button
                  onClick={() => setDirectMode(false)}
                  className="px-3.5 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {t('⇄ Modo perguntas')}
                </button>
              </div>

              <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <WeightSliders
                    orderedIds={orderedChildIds}
                    weights={draft}
                    labelOf={(id) => criteria[id]?.label ?? id}
                    onChange={setDraft}
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {t('Juízos implicados')} <span className="text-indigo-600">· {t('ao vivo')}</span>
                  </p>
                  {weightReadings(orderedChildIds, draft, (id) => criteria[id]?.label ?? id).map((r) => (
                    <div key={r.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2">
                      <span
                        className="w-1.5 rounded-full bg-indigo-500 shrink-0"
                        style={{ height: 6 + r.cat * 4 }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0 truncate text-xs text-gray-600">{r.more} &gt; {r.less}</span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                        {t(r.label)}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={applyDirect}
                    className="w-full mt-3 px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700"
                  >
                    {t('Aplicar e calcular pesos')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Passo 1 — ranking by importance */}
              <div className="space-y-3">
                <details className="group/help">
                  <summary className="text-sm font-semibold text-gray-700 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-900">
                    <span className="text-gray-400 text-xs transition-transform group-open/help:rotate-90">▸</span>
                    {t('Passo 1 — Ordene os critérios por importância')}
                  </summary>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed pl-4">
                    {t('Antes de quantificar, ordene os critérios do mais para o menos importante — ou seja, aquele cuja melhoria de Neutro para Bom traria mais valor fica no topo. As perguntas seguintes seguem esta ordem, comparando sempre o critério mais importante com o menos importante, o que torna cada comparação mais natural. (Ordene primeiro; alterar a ordem depois de responder pode baralhar as respostas já dadas.)')}
                  </p>
                </details>
                <ol className="space-y-1.5">
                  {orderedChildIds.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                      <span className="w-5 text-center text-xs font-bold text-blue-700 shrink-0">{t('{{n}}º', { n: i + 1 })}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate" title={criteria[id]?.label}>{criteria[id]?.label ?? id}</span>
                      <span className="text-xs text-gray-400 shrink-0">{jumpOf(id)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                          e.preventDefault();
                          moveCriterion(i, e.key === 'ArrowUp' ? -1 : 1);
                        }}
                        className="text-gray-300 hover:text-gray-600 cursor-grab shrink-0 focus:outline-none focus:text-indigo-600 focus:ring-2 focus:ring-indigo-300 rounded"
                        title={t('Arrastar para reordenar (ou ↑/↓ com o teclado)')}
                        aria-label={t('Reordenar «{{label}}» — posição {{i}} de {{n}}', { label: criteria[id]?.label ?? id, i: i + 1, n: orderedChildIds.length })}
                      >
                        <IconGrip className="w-3.5 h-4" />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Passo 2 — pairwise comparisons */}
              <div className="bg-sky-50 rounded-2xl px-4 py-3 flex gap-3 items-start mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 shrink-0 pt-0.5 w-16">{t('Cenário')}</span>
                <p className="text-[13px] text-sky-900/80 leading-relaxed">
                  {t('Imagine uma proposta no mínimo aceitável em todos os critérios — nada de excecional, nada inaceitável. É esse o ponto de partida (valor 0). Só tem orçamento para corrigir um aspeto.')}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-700 pt-1">{t('Passo 2 — Compare a importância dos pares')}</p>
              <GuidedJudgments
                items={matrixItems}
                judgments={matrix.judgments}
                onChange={updateJudgments}
                onActivePairChange={setActivePairKey}
                emptyHint="São necessários pelo menos 2 critérios."
                renderQuestion={(more, less) =>
                  less.id === ALL_NEUTRAL ? (
                    <>
                      {t('Quanto valor traria corrigir')}{' '}
                      <span className="inline-block bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-0.5 font-bold text-indigo-700">{more.label}</span>
                      {t(', deixando tudo o resto no mínimo aceitável?')}
                    </>
                  ) : (
                    <>
                      {t('Qual destas melhorias traria mais valor à proposta?')}
                      <span className="grid sm:grid-cols-2 gap-2.5 mt-3 text-sm font-normal">
                        <span className="border-[1.5px] border-indigo-400 bg-indigo-50 rounded-xl px-3 py-2.5">
                          <span className="block font-bold text-indigo-800">{more.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">{jumpOf(more.id)}</span>
                        </span>
                        <span className="border-[1.5px] border-gray-200 rounded-xl px-3 py-2.5">
                          <span className="block font-bold text-gray-700">{less.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">{jumpOf(less.id)}</span>
                        </span>
                      </span>
                    </>
                  )
                }
              />

              {/* Collapsed by default: the guided questions above already collect
                  every judgment; the grid is the power-user view of the same data. */}
              <details className="border-t border-gray-100 pt-3 group">
                <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-700">
                  <span className="transition-transform group-open:rotate-90">▸</span> {t('Matriz de juízos')}
                </summary>
                <JudgmentMatrixEditor items={matrixItems} judgments={matrix.judgments} onChange={updateJudgments} activePairKey={activePairKey ?? undefined} />
              </details>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDerive}
                  disabled={deriving || Object.keys(matrix.judgments).length === 0}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-full font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40"
                >
                  {deriving ? t('A calcular pesos…') : t('Calcular pesos deste grupo')}
                </button>
                <button
                  onClick={simulate}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  title={t('Gera um conjunto completo e consistente de juízos a partir da ordem de importância (método ROC).')}
                >
                  ⚡ {t('Simular a partir da ordem')}
                </button>
                <button
                  onClick={openDirect}
                  className="px-4 py-2 rounded-full text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                  title={t('Definir os pesos diretamente e ver que juízos MACBETH isso implica.')}
                >
                  ⇄ {t('Modo pesos diretos')}
                </button>
                {simulated && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                    {t('juízos simulados — por confirmar')}
                  </span>
                )}
              </div>

              {simulated && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3.5 py-2.5 leading-relaxed">
                  {t('Pesos simulados não são preferências elicitadas: servem para arrancar depressa ou testar hipóteses. Percorra as perguntas acima e ajuste o que não corresponder ao seu juízo antes de dar o modelo por fechado.')}
                </p>
              )}

              {weights && (() => {
                const groupFactor = groupEffectiveWeight(model, group.parentId);
                // Show the global column only for nested groups (where local ≠ global).
                const showGlobal = groupFactor != null && groupFactor < 0.999;
                return (
                  <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 text-sm">{t('Pesos derivados (Σ = 1 no grupo)')}</h3>
                      <div className="flex items-center gap-2">
                        {showGlobal && (
                          <span className="text-xs text-gray-400">
                            {t('grupo =')} <strong className="text-gray-500">{(groupFactor! * 100).toFixed(0)}%</strong> {t('do modelo')}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${weights.consistencyMargin > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          z = {weights.consistencyMargin.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    {showGlobal && (
                      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                        <span className="w-40 shrink-0" />
                        <span className="flex-1">{t('Peso no grupo (local)')}</span>
                        <span className="w-16 text-right" />
                        <span className="w-[5.5rem] text-right">{t('Global no modelo')}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {weights.weights.map((w) => {
                        const crit = criteria[w.criterionId];
                        const global = groupFactor != null ? groupFactor * w.weight : null;
                        return (
                          <div key={w.criterionId} className="flex items-center gap-3">
                            <span className="w-40 text-sm truncate text-gray-700" title={crit?.label}>{crit?.label ?? w.criterionId}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4">
                              <div className="h-4 rounded-full bg-blue-500" style={{ width: `${(w.weight * 100).toFixed(1)}%` }} />
                            </div>
                            <span
                              className="w-16 text-right text-sm font-mono font-medium"
                              title={t('Intervalo admissível: [{{lo}}%, {{hi}}%]', { lo: (w.admissibleRange[0] * 100).toFixed(1), hi: (w.admissibleRange[1] * 100).toFixed(1) })}
                            >
                              {(w.weight * 100).toFixed(1)}%
                            </span>
                            {showGlobal ? (
                              <span className="w-[5.5rem] flex items-center gap-1.5 justify-end">
                                <span className="text-gray-300">→</span>
                                <span className="w-12 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <span className="block h-full rounded-full bg-indigo-300" style={{ width: `${global != null ? (global * 100).toFixed(1) : 0}%` }} />
                                </span>
                                <span className="w-10 text-right text-xs font-mono text-gray-500">
                                  {global != null ? `${(global * 100).toFixed(1)}%` : '—'}
                                </span>
                              </span>
                            ) : (
                              <span className="w-36 text-xs text-gray-400 font-mono">
                                [{(w.admissibleRange[0] * 100).toFixed(1)}%, {(w.admissibleRange[1] * 100).toFixed(1)}%]
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {showGlobal && (
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        ⚖️ {t('Está a ponderar')} <strong>{t('dentro de «{{label}}»', { label: group.label })}</strong>. {t('O peso global = {{p}}% (do grupo) × peso local — é esse que pesa no resultado final.', { p: (groupFactor! * 100).toFixed(0) })}
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Weighting() {
  const { t } = useTranslation();
  const { state } = useApp();
  const model = state.model!;

  const groups = weightingGroups(model).filter((g) => g.childIds.length > 0);
  // Open only the first group still needing work: expanding every group at once
  // stacks the same two-step explainer and matrix N times, and a model with a
  // handful of factors becomes several screens of near-identical content.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const firstPending = groups.find((g) => !groupConsistent(model, g));
    return new Set(firstPending ? [firstPending.parentId] : []);
  });

  function toggle(parentId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>{t('Sem critérios de qualificação. Defina-os na Estruturação.')}</p>
      </div>
    );
  }

  const allReady = groups.every((g) => groupConsistent(model, g));
  const multiGroup = groups.length > 1;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">{t('O que pesa mais?')}</p>
        <p>
          {t('Decida a importância relativa antes do trabalho detalhado das escalas. Cada pergunta é uma escolha entre duas melhorias concretas — ou responda depressa simulando a partir da ordem de importância.')}
        </p>
        {multiGroup && (
          <p className="text-xs text-blue-600">
            {t('Existem fatores compostos: pondere os filhos dentro de cada grupo. O peso global de cada folha é o produto dos pesos ao longo do caminho até à raiz.')}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <GroupPanel key={g.parentId} group={g} open={openGroups.has(g.parentId)} onToggle={() => toggle(g.parentId)} />
        ))}
      </div>

      <ScreenNav
        next="scales"
        nextLabel="Escalas"
        hint="Com os pesos definidos, construa a escala de valor de cada critério."
        blockedBy={!allReady ? 'Calcule pesos consistentes em todos os grupos antes de avançar.' : undefined}
      />
    </div>
  );
}
