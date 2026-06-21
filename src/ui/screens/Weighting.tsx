import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import type { MacbethJudgment, JudgmentMatrix } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID, ROOT_ID } from '../../domain/types';
import { deriveWeights, ALL_NEUTRAL } from '../../engine/weighting';
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
          ) : (
            <>
              {/* Passo 1 — ranking by importance */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t('Passo 1 — Ordene os critérios por importância')}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {t('Antes de quantificar, ordene os critérios do mais para o menos importante — ou seja, aquele cuja melhoria de Neutro para Bom traria mais valor fica no topo. As perguntas seguintes seguem esta ordem, comparando sempre o critério mais importante com o menos importante, o que torna cada comparação mais natural. (Ordene primeiro; alterar a ordem depois de responder pode baralhar as respostas já dadas.)')}
                  </p>
                </div>
                <ol className="space-y-1.5">
                  {orderedChildIds.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                      <span className="w-5 text-center text-xs font-bold text-blue-700 shrink-0">{t('{{n}}º', { n: i + 1 })}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate" title={criteria[id]?.label}>{criteria[id]?.label ?? id}</span>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveCriterion(i, -1)}
                          disabled={i === 0}
                          className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
                          aria-label={t('Subir (mais importante)')}
                        >▲</button>
                        <button
                          onClick={() => moveCriterion(i, 1)}
                          disabled={i === orderedChildIds.length - 1}
                          className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs leading-none"
                          aria-label={t('Descer (menos importante)')}
                        >▼</button>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Passo 2 — pairwise comparisons */}
              <p className="text-sm font-semibold text-gray-700 pt-2">{t('Passo 2 — Compare a importância dos pares')}</p>
              <GuidedJudgments
                items={matrixItems}
                judgments={matrix.judgments}
                onChange={updateJudgments}
                onActivePairChange={setActivePairKey}
                emptyHint="São necessários pelo menos 2 critérios."
                renderQuestion={(more, less) =>
                  less.id === ALL_NEUTRAL ? (
                    <>
                      <span className="block text-sm font-normal text-gray-500 mb-2">
                        {t('Tudo parte do nível Neutro (a referência, valor 0).')}
                      </span>
                      {t('Quão atrativo é levar só')}{' '}
                      <span className="inline-block bg-white border border-blue-400 rounded-lg px-2 py-0.5 font-semibold text-blue-700">{more.label}</span>
                      {' '}{t('de Neutro até Bom?')}
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-normal text-gray-500 mb-2">
                        {t('Só pode levar um critério de Neutro até Bom — os restantes ficam em Neutro.')}
                      </span>
                      {t('Quanto mais atrativo é escolher')}{' '}
                      <span className="inline-block bg-white border border-blue-400 rounded-lg px-2 py-0.5 font-semibold text-blue-700">{more.label}</span>
                      {' '}{t('do que')}{' '}
                      <span className="inline-block bg-white border border-gray-300 rounded-lg px-2 py-0.5 font-semibold text-gray-700">{less.label}</span>?
                    </>
                  )
                }
              />

              <details className="border-t border-gray-100 pt-3 group" open={matrixItems.length <= 4}>
                <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-700">
                  <span className="transition-transform group-open:rotate-90">▸</span> {t('Matriz de juízos')}
                </summary>
                <JudgmentMatrixEditor items={matrixItems} judgments={matrix.judgments} onChange={updateJudgments} activePairKey={activePairKey ?? undefined} />
              </details>

              <button
                onClick={handleDerive}
                disabled={deriving || Object.keys(matrix.judgments).length === 0}
                className="px-5 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
              >
                {deriving ? t('A calcular pesos…') : t('Calcular pesos deste grupo')}
              </button>

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
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups.map((g) => g.parentId)));

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
        <p className="font-medium">{t('Ponderação por Oscilação (Swing Weighting)')}</p>
        <p>
          {t('Compare a atratividade de oscilar cada critério de Neutro para Bom. A referência «Tudo-Neutro» é o ponto de partida (valor = 0).')}
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
        next="decision"
        nextLabel="Perfis de decisão"
        hint="Com escalas e pesos de todos os grupos definidos, construa os perfis de decisão (limiares MACBETH)."
        blockedBy={!allReady ? 'Calcule pesos consistentes em todos os grupos antes de avançar.' : undefined}
      />
    </div>
  );
}
