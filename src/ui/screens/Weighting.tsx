import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { useDialogs } from '../components/Dialog';
import type { MacbethJudgment, JudgmentMatrix, WeightProvenance } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID, ROOT_ID } from '../../domain/types';
import { deriveWeights, ALL_NEUTRAL } from '../../engine/weighting';
import { simulateWeighting, judgmentsFromWeights } from '../../engine/simulate';
import WeightSliders, { weightReadings, type WeightMap } from '../components/WeightSliders';
import { IconGrip } from '../components/icons';
import {
  weightingGroups, weightsForGroup, setGroupWeights, groupConsistent, groupEffectiveWeight,
  descendantQualifications, type Group,
} from '../../domain/tree';
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
  // Direct-weight mode: a second input surface writing the same judgments.
  const [directMode, setDirectMode] = useState(false);
  const [draft, setDraft] = useState<WeightMap>({});
  const dialogs = useDialogs();
  /**
   * How the judgments about to be derived were produced. Persisted onto the
   * derived `Weights` rather than kept in component state: a flag that says
   * "these were simulated, not elicited" is part of the audit trail, and this
   * one used to vanish on reload — leaving a model whose weights nobody had
   * actually agreed to, indistinguishable from one they had.
   */
  const provenanceRef = useRef<WeightProvenance>('elicited');

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
   *
   * A *factor* has no descriptor of its own, and used to show nothing at all —
   * so "Qualidade técnica" appeared as a bare name beside "Custo anual: 25–50 k€
   * → < 10 k€", with no way to tell what improving it would even mean. Its swing
   * is every criterion underneath it moving from Neutro to Bom, so that is what
   * it says.
   */
  function jumpOf(id: string): string {
    const c = criteria[id];
    if (c?.type === 'qualification') {
      const { levels, neutralIndex, goodIndex } = c.descriptor;
      const from = levels[neutralIndex]?.label;
      const to = levels[goodIndex]?.label;
      return from && to ? `${from} → ${to}` : '';
    }
    if (c?.type === 'composite') {
      const leaves = descendantQualifications(model, id);
      if (leaves.length === 0) return '';
      return t('todos os seus critérios de Neutro → Bom');
    }
    return '';
  }

  /** The individual swings a factor bundles, for the second line of its card. */
  function subJumps(id: string): string {
    const c = criteria[id];
    if (c?.type !== 'composite') return '';
    return descendantQualifications(model, id)
      .slice(0, 3)
      .map((leaf) => {
        const { levels, neutralIndex, goodIndex } = leaf.descriptor;
        return `${leaf.label}: ${levels[neutralIndex]?.label} → ${levels[goodIndex]?.label}`;
      })
      .join(' · ');
  }

  /**
   * Seed every judgment in this group from the importance ranking alone, via
   * Rank Order Centroid. Marked as suggested until reviewed: a simulated weight
   * is not an elicited preference, and the audit trail has to keep them apart.
   */
  async function simulate() {
    if (Object.keys(matrix.judgments).length > 0) {
      const ok = await dialogs.confirm({
        title: t('Substituir as respostas já dadas neste grupo?'),
        body: t('Os juízos passam a ser gerados a partir da ordem de importância (método ROC). Ficam marcados como simulados até os confirmar.'),
        confirmLabel: t('Substituir'),
      });
      if (!ok) return;
    }
    const { judgments } = simulateWeighting(orderedChildIds);
    updateJudgments(judgments);
    provenanceRef.current = 'simulated';
    // Derive here rather than leaving it to the effect: filling an already-full
    // matrix produces the same judgments, so the effect sees no change and
    // never runs — and the weights would keep whatever provenance they had.
    lastDerived.current = `${JSON.stringify(judgments)}`;
    await derive(judgments, 'simulated');
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
    const judgments = judgmentsFromWeights(orderedChildIds, draft);
    updateJudgments(judgments);
    setDirectMode(false);
    provenanceRef.current = 'direct';
    await derive(judgments, 'direct');
  }

  async function derive(judgments: Record<string, MacbethJudgment>, provenance: WeightProvenance) {
    setDeriving(true);
    try {
      const w = await deriveWeights(orderedChildIds, judgments);
      dispatch({
        type: 'UPDATE_MODEL',
        patch: setGroupWeights(model, group.parentId, { ...w, provenance, confirmed: provenance === 'elicited' }),
      });
    } finally {
      setDeriving(false);
    }
  }

  /**
   * Derive as soon as the group's comparisons are all answered.
   *
   * The button it replaces sat below the questions with no visible link to
   * them, so answering everything left the screen looking finished while the
   * weights were still stale — and the run had no ending anyway. Keyed on the
   * judgments themselves so re-renders don't re-solve.
   */
  const judgmentsKey = JSON.stringify(matrix.judgments);
  const lastDerived = useRef<string | null>(null);
  useEffect(() => {
    if (single || directMode) return;
    const pairCount = (matrixItems.length * (matrixItems.length - 1)) / 2;
    if (Object.keys(matrix.judgments).length < pairCount) return;
    if (lastDerived.current === judgmentsKey) return;
    // Reopening a model whose weights are already derived: adopt them instead
    // of solving again. Re-deriving would produce the same numbers but stamp
    // them 'elicited', erasing the record that they were simulated and never
    // confirmed — the exact thing persisting provenance was meant to prevent.
    if (lastDerived.current === null && weights && weights.consistencyMargin > 0) {
      lastDerived.current = judgmentsKey;
      provenanceRef.current = weights.provenance ?? 'elicited';
      return;
    }
    lastDerived.current = judgmentsKey;
    void derive(matrix.judgments, provenanceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgmentsKey, single, directMode]);

  /** The user has read the simulated/direct weights and stands by them. */
  function confirmWeights() {
    if (!weights) return;
    dispatch({
      type: 'UPDATE_MODEL',
      patch: setGroupWeights(model, group.parentId, { ...weights, confirmed: true }),
    });
  }

  const matrixItems = [
    ...orderedChildIds.map((id) => ({ id, label: criteria[id]?.label ?? id })),
    { id: ALL_NEUTRAL, label: t('Proposta neutra (ref.)') },
  ];

  /** Weights that came from a shortcut and have not yet been signed off. */
  const needsConfirmation =
    !!weights &&
    weights.provenance != null &&
    weights.provenance !== 'elicited' &&
    !weights.confirmed;

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
          <span className={`text-xs font-semibold ${needsConfirmation ? 'text-amber-600' : 'text-green-600'}`}>
            {needsConfirmation ? t('por confirmar') : `✓ ${t('coerente')}`}
          </span>
        ) : (
          <span className="text-xs font-semibold text-gray-400">
            {t('{{a}} de {{n}} respondidas', { a: Object.keys(matrix.judgments).length, n: (matrixItems.length * (matrixItems.length - 1)) / 2 })}
          </span>
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
                    className="w-full mt-3 px-4 py-2 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-strong"
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
                {/* "Neutro" is the level that is neither attractive nor repulsive
                    — not the minimum acceptable. Levels below it exist and score
                    negative, as the derived scales visibly do, so describing it
                    as a floor contradicted the numbers the user was about to see. */}
                <p className="text-[13px] text-sky-900/80 leading-relaxed">
                  {t('Parta de uma proposta neutra em tudo — nem boa nem má em nenhum critério, valor 0. Pode melhorar um só critério até ao nível «Bom». Qual das duas melhorias vale mais, e quanto mais?')}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-700 pt-1">{t('Passo 2 — Compare a importância dos pares')}</p>
              <GuidedJudgments
                items={matrixItems}
                judgments={matrix.judgments}
                onChange={updateJudgments}
                onActivePairChange={setActivePairKey}
                emptyHint="São necessários pelo menos 2 critérios."
                doneHint="Todas as comparações deste grupo estão respondidas — os pesos abaixo já as refletem."
                renderQuestion={(more, less) =>
                  less.id === ALL_NEUTRAL ? (
                    <>
                      {t('Partindo de uma proposta neutra em tudo, quanto valor traria melhorar')}{' '}
                      <span className="inline-block bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-0.5 font-bold text-indigo-700">{more.label}</span>
                      {t(' até «Bom»?')}
                    </>
                  ) : (
                    <>
                      {/* The ranking in step 1 already fixed *which* is worth
                          more. Asking "qual?" again and answering it with a
                          magnitude scale is a question whose answer does not fit. */}
                      {t('Quanto')} <u>{t('mais')}</u> {t('vale a melhoria da esquerda do que a da direita?')}
                      <span className="grid sm:grid-cols-2 gap-2.5 mt-3 text-sm font-normal">
                        <span className="border-[1.5px] border-indigo-400 bg-indigo-50 rounded-xl px-3 py-2.5">
                          <span className="block font-bold text-indigo-800">{more.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">{jumpOf(more.id)}</span>
                          {subJumps(more.id) && (
                            <span className="block text-[11px] text-gray-400 mt-0.5">{subJumps(more.id)}</span>
                          )}
                        </span>
                        <span className="border-[1.5px] border-gray-200 rounded-xl px-3 py-2.5">
                          <span className="block font-bold text-gray-700">{less.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">{jumpOf(less.id)}</span>
                          {subJumps(less.id) && (
                            <span className="block text-[11px] text-gray-400 mt-0.5">{subJumps(less.id)}</span>
                          )}
                        </span>
                      </span>
                      <span className="block text-xs font-normal text-gray-400 mt-2">
                        {t('Se acha que vale menos, é a ordem do passo 1 que está errada — troque-os lá.')}
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
                <span className="text-xs text-gray-400 flex-1 min-w-[14rem]">
                  {deriving
                    ? t('A calcular os pesos…')
                    : t('Sem botão «calcular»: os pesos derivam-se assim que as respostas estiverem completas.')}
                </span>
                <button
                  onClick={simulate}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  title={t('Gera um conjunto completo e consistente de juízos a partir da ordem de importância (método ROC).')}
                >
                  ⚡ {t('Preencher a partir da ordem')}
                </button>
                <button
                  onClick={openDirect}
                  className="px-4 py-2 rounded-full text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                  title={t('Definir os pesos diretamente e ver que juízos MACBETH isso implica.')}
                >
                  ⇄ {t('Definir pesos à mão')}
                </button>
              </div>

              {needsConfirmation && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 space-y-2">
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <strong>
                      {weights?.provenance === 'direct'
                        ? t('Pesos definidos à mão — por confirmar.')
                        : t('Pesos simulados a partir da ordem — por confirmar.')}
                    </strong>{' '}
                    {t('Não são preferências elicitadas: servem para arrancar depressa ou testar hipóteses. Percorra as perguntas acima e ajuste o que não corresponder ao seu juízo.')}
                  </p>
                  <button
                    onClick={confirmWeights}
                    className="px-3 py-1.5 text-xs font-semibold bg-caution text-white rounded-lg hover:bg-caution-strong"
                  >
                    {t('Revi e confirmo estes pesos')}
                  </button>
                </div>
              )}

              {weights && (() => {
                const groupFactor = groupEffectiveWeight(model, group.parentId);
                // Show the global column only for nested groups (where local ≠ global).
                const showGlobal = groupFactor != null && groupFactor < 0.999;
                return (
                  <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 text-sm">{t('Pesos — atualizados a cada resposta')}</h3>
                      <div className="flex items-center gap-2">
                        {showGlobal && (
                          <span className="text-xs text-gray-400">
                            {t('grupo =')} <strong className="text-gray-500">{(groupFactor! * 100).toFixed(0)}%</strong> {t('do modelo')}
                          </span>
                        )}
                        {/* "z = 0.0385" is an internal of the LP, not a reading
                            for the assessor. What it certifies — that the
                            answers do not contradict each other — is. */}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${weights.consistencyMargin > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                          title={t('Margem de discriminação z = {{m}}', { m: weights.consistencyMargin.toFixed(4) })}
                        >
                          {weights.consistencyMargin > 0 ? `✓ ${t('coerente')}` : t('contradição')}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {t('A faixa clara é o intervalo de pesos ainda compatível com as respostas dadas — quanto mais larga, mais falta decidir.')}
                    </p>
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
                            {/* The bar is the derived weight; the pale band
                                behind it is everything still compatible with the
                                answers. Both matter: a 50% that could be anywhere
                                from 38% to 64% is a different fact from a 50%
                                that is pinned. */}
                            <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                              <div
                                className="absolute inset-y-0 bg-indigo-100 border-x border-indigo-300"
                                style={{
                                  left: `${(w.admissibleRange[0] * 100).toFixed(1)}%`,
                                  width: `${Math.max(0, (w.admissibleRange[1] - w.admissibleRange[0]) * 100).toFixed(1)}%`,
                                }}
                                aria-hidden="true"
                              />
                              <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500/80" style={{ width: `${(w.weight * 100).toFixed(1)}%` }} />
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
    // Open the first group that still needs the user: unanswered comparisons,
    // or weights taken from a shortcut and not yet signed off. A collapsed
    // group showing "por confirmar" is a prompt nobody can act on.
    const firstPending = groups.find((g) => {
      if (!groupConsistent(model, g)) return true;
      const w = weightsForGroup(model, g.parentId);
      return !!w && w.provenance != null && w.provenance !== 'elicited' && !w.confirmed;
    });
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
