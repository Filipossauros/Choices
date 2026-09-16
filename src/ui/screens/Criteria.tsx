import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { repository } from '../../repository';
import type {
  Criterion,
  EvaluationModel,
  QualificationCriterion,
  GateCriterion,
  CompositeCriterion,
  PerformanceLevel,
  ValueTreeNode,
} from '../../domain/types';
import { ROOT_ID } from '../../domain/types';
import { addChild, updateCriterion, removeNode, findNode, parentOf, reorderChild, insertSubtree } from '../../domain/tree';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';
import { useDialogs } from '../components/Dialog';
import { IconGate, IconQualification, IconComposite, IconGrip } from '../components/icons';

/**
 * Three blank levels, not five adjectives.
 *
 * The old default — "Excelente / Bom / Suficiente / Neutro / Insuficiente" —
 * taught the wrong habit twice over: a MACBETH descriptor describes concrete
 * performance ("< 200 ms", "25–50 k€"), not a Likert rating; and two of those
 * labels collided with the *anchor* names sitting right beside them, so a level
 * called "Bom" could perfectly well not be the level marked Bom.
 */
const DEFAULT_LEVEL_COUNT = 3;
const LEVEL_PLACEHOLDERS = ['ex.: < 200 ms', 'ex.: 200–500 ms', 'ex.: > 500 ms'];

type CritType = 'gate' | 'qualification' | 'composite';

function LevelEditor({
  levels,
  neutralIndex,
  goodIndex,
  vetoLevelId,
  unit,
  onChange,
  onUnitChange,
}: {
  levels: PerformanceLevel[];
  neutralIndex: number;
  goodIndex: number;
  vetoLevelId?: string;
  unit?: string;
  onChange: (levels: PerformanceLevel[], neutralIndex: number, goodIndex: number, vetoLevelId?: string) => void;
  onUnitChange: (unit: string) => void;
}) {
  const { t } = useTranslation();
  function addLevel() {
    onChange([...levels, { id: uuidv4(), label: '' }], neutralIndex, goodIndex, vetoLevelId);
  }
  function removeLevel(i: number) {
    const next = levels.filter((_, j) => j !== i);
    onChange(next, Math.min(neutralIndex, next.length - 1), Math.min(goodIndex, next.length - 1), vetoLevelId);
  }
  function patchLevel(i: number, patch: Partial<PerformanceLevel>) {
    onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)), neutralIndex, goodIndex, vetoLevelId);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[i], next[j]] = [next[j], next[i]];
    const ni = neutralIndex === i ? j : neutralIndex === j ? i : neutralIndex;
    const gi = goodIndex === i ? j : goodIndex === j ? i : goodIndex;
    onChange(next, ni, gi, vetoLevelId);
  }

  const numericCount = levels.filter((l) => typeof l.numericValue === 'number' && Number.isFinite(l.numericValue)).length;
  const numericComplete = levels.length > 1 && numericCount === levels.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-400 italic flex-1 min-w-[12rem]">
          {t('Do mais para o menos atrativo (↑ = melhor). Descreva o desempenho concreto, não uma nota.')}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          {t('Unidade (opcional)')}
          <input
            value={unit ?? ''}
            onChange={(e) => onUnitChange(e.target.value)}
            placeholder={t('ms, €, dias…')}
            className="w-24 border border-gray-200 rounded px-2 py-1 text-xs"
          />
        </label>
      </div>
      {levels.map((level, i) => (
        <div key={level.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-gray-100 pb-2 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none" aria-label={t('Subir nível')}>▲</button>
            <button onClick={() => move(i, 1)} disabled={i === levels.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none" aria-label={t('Descer nível')}>▼</button>
          </div>
          <input
            value={level.label}
            onChange={(e) => patchLevel(i, { label: e.target.value })}
            className="flex-1 min-w-[7rem] border border-gray-200 rounded px-2 py-1 text-sm"
            placeholder={t(LEVEL_PLACEHOLDERS[i] ?? 'Descrição do nível')}
            aria-label={t('Nível {{n}}', { n: i + 1 })}
          />
          <input
            type="number"
            value={level.numericValue ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              patchLevel(i, { numericValue: raw === '' ? undefined : Number(raw) });
            }}
            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center"
            placeholder={t('valor')}
            title={t('Leitura deste nível na escala de medida (opcional, mas necessária para desempenho contínuo)')}
            aria-label={t('Valor numérico do nível {{n}}', { n: i + 1 })}
          />
          {/* On mobile these anchors wrap to their own line under the input */}
          <div className="flex items-center gap-3 basis-full sm:basis-auto pl-7 sm:pl-0">
            <label className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer">
              <input type="radio" name={`neutral-${levels[0]?.id}`} checked={neutralIndex === i} onChange={() => onChange(levels, i, goodIndex, vetoLevelId)} />
              {t('Neutro')}
            </label>
            <label className="flex items-center gap-1 text-xs text-green-600 cursor-pointer">
              <input type="radio" name={`good-${levels[0]?.id}`} checked={goodIndex === i} onChange={() => onChange(levels, neutralIndex, i, vetoLevelId)} />
              {t('Bom')}
            </label>
            <label className="flex items-center gap-1 text-xs text-orange-600 cursor-pointer" title={t('Veto: reprova abaixo deste nível')}>
              <input type="checkbox" checked={vetoLevelId === level.id} onChange={(e) => onChange(levels, neutralIndex, goodIndex, e.target.checked ? level.id : undefined)} />
              {t('Veto')}
            </label>
            <button onClick={() => removeLevel(i)} className="text-red-400 hover:text-red-600 text-sm px-1 ml-auto sm:ml-0" aria-label={t('Remover nível {{n}}', { n: i + 1 })}>✕</button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={addLevel} className="text-sm text-blue-600 hover:text-blue-800">
          {t('+ Adicionar nível')}
        </button>
        {numericCount > 0 && !numericComplete && (
          <span className="text-xs text-amber-700">
            {t('Faltam {{n}} valores numéricos para o eixo de medida ficar completo.', { n: levels.length - numericCount })}
          </span>
        )}
      </div>
    </div>
  );
}

function CriterionForm({
  initial,
  /** When adding under the root, composite (factor) is offered; otherwise too. */
  onSave,
  onCancel,
}: {
  initial?: Criterion;
  onSave: (c: Criterion) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<CritType>(initial?.type ?? 'qualification');

  const initQ = initial?.type === 'qualification' ? initial : null;
  const [levels, setLevels] = useState<PerformanceLevel[]>(
    initQ?.descriptor.levels ??
      Array.from({ length: DEFAULT_LEVEL_COUNT }, () => ({ id: uuidv4(), label: '' })),
  );
  const [neutralIndex, setNeutralIndex] = useState(initQ?.descriptor.neutralIndex ?? DEFAULT_LEVEL_COUNT - 1);
  const [goodIndex, setGoodIndex] = useState(initQ?.descriptor.goodIndex ?? 0);
  const [unit, setUnit] = useState<string>(initQ?.descriptor.unit ?? '');
  const [vetoLevelId, setVetoLevelId] = useState<string | undefined>(initQ?.vetoLevelId);
  const [continuous, setContinuous] = useState<boolean>(initQ?.continuous ?? false);

  /**
   * Continuous scoring reads a value off the curve at a position along the
   * descriptor, so that position has to mean something. Without a reading on
   * every level the only axis available is the level *index*, which spaces
   * "≤ 2 dias" and "> 10 dias" one step apart — so the option is withheld
   * rather than offered and quietly misused.
   */
  const numericAxisReady =
    levels.length > 1 &&
    levels.every((l) => typeof l.numericValue === 'number' && Number.isFinite(l.numericValue)) &&
    new Set(levels.map((l) => l.numericValue)).size > 1;

  /**
   * Escape hatch from the eliminatory type: a yes/no question that should merely
   * score badly is a two-level qualification, not a gate. Anchoring "Não" at
   * Neutro (0) and "Sim" at Bom (100) needs no judgments — both levels are the
   * anchors, so the scale derives trivially.
   */
  function convertToBinaryQualification() {
    setType('qualification');
    setLevels([
      { id: uuidv4(), label: t('Sim') },
      { id: uuidv4(), label: t('Não') },
    ]);
    setGoodIndex(0);
    setNeutralIndex(1);
    setVetoLevelId(undefined);
    setContinuous(false);
  }

  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    if (!label.trim()) return setError(t('Dê um nome ao critério.'));
    const id = initial?.id ?? uuidv4();
    if (type === 'gate') {
      onSave({ id, label: label.trim(), description, type: 'gate' } as GateCriterion);
    } else if (type === 'composite') {
      onSave({ id, label: label.trim(), description, type: 'composite' } as CompositeCriterion);
    } else {
      if (levels.length < 2) return setError(t('São necessários pelo menos 2 níveis de desempenho.'));
      if (levels.some((l) => !l.label.trim())) {
        return setError(t('Descreva todos os níveis — cada um deve dizer que desempenho representa.'));
      }
      if (neutralIndex === goodIndex) {
        return setError(t('Neutro e Bom têm de ser níveis diferentes: são as duas referências da escala.'));
      }
      if (goodIndex > neutralIndex) {
        return setError(t('«Bom» tem de ser mais atrativo do que «Neutro» — coloque-o acima na lista.'));
      }
      onSave({
        id,
        label: label.trim(),
        description,
        type: 'qualification',
        descriptor: {
          levels: levels.map((l) => ({ ...l, label: l.label.trim() })),
          neutralIndex,
          goodIndex,
          ...(unit.trim() ? { unit: unit.trim() } : {}),
        },
        vetoLevelId,
        continuous: continuous && numericAxisReady,
      } as QualificationCriterion);
    }
  }

  // A criterion that already has children can only stay a composite.
  const lockedComposite = initial?.type === 'composite';

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Nome')}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder={t('Ex.: Segurança, Latência, Custo…')} autoFocus />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Descrição (opcional)')}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Tipo')}</label>
          <div className="flex flex-wrap gap-4">
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'composite'} disabled={lockedComposite && type !== 'composite'} onChange={() => setType('composite')} />
              <span className="text-sm flex items-center gap-1.5"><IconComposite className="w-4 h-4 text-emerald-600" /> {t('Fator — agrupa e reparte peso')}</span>
            </label>
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'qualification'} disabled={lockedComposite} onChange={() => setType('qualification')} />
              <span className="text-sm flex items-center gap-1.5"><IconQualification className="w-4 h-4 text-indigo-600" /> {t('Critério — mede desempenho')}</span>
            </label>
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'gate'} disabled={lockedComposite} onChange={() => setType('gate')} />
              <span className="text-sm flex items-center gap-1.5"><IconGate className="w-4 h-4 text-orange-600" /> {t('Condição eliminatória — exclui à partida')}</span>
            </label>
          </div>
          {lockedComposite && (
            <p className="text-xs text-gray-400 mt-1">{t('Este fator tem subcritérios. Remova-os para mudar o tipo.')}</p>
          )}
        </div>
      </div>

      {type === 'composite' && (
        <p className="text-sm text-gray-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {t('Um fator composto agrega os seus subcritérios por ponderação. Depois de o guardar, use «+ subcritério» para o decompor. A sua pontuação é calculada a partir dos filhos.')}
        </p>
      )}

      {type === 'gate' && (
        <div className="text-sm bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 space-y-2.5">
          <p className="text-orange-900">
            <strong>{t('Elimina a proposta inteira.')}</strong>{' '}
            {t('Se a resposta for «não cumpre», a proposta é excluída sem chegar a ser pontuada — não é compensada por nenhum outro critério. O alcance é sempre global, mesmo que esta condição esteja dentro de um fator.')}
          </p>
          <div className="border-t border-orange-200 pt-2.5">
            <p className="text-xs text-orange-800/80 mb-2">
              {t('Se «não» devesse apenas pontuar mal — admitindo compensação pelos restantes critérios — então isto não é uma condição eliminatória, mas um critério de qualificação com dois níveis.')}
            </p>
            <button
              type="button"
              onClick={convertToBinaryQualification}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50"
            >
              {t('Converter em critério Sim/Não (pontua, não elimina)')}
            </button>
          </div>
        </div>
      )}

      {type === 'qualification' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">{t('Níveis de desempenho')}</p>
          <LevelEditor
            levels={levels}
            neutralIndex={neutralIndex}
            goodIndex={goodIndex}
            vetoLevelId={vetoLevelId}
            unit={unit}
            onUnitChange={setUnit}
            onChange={(l, ni, gi, veto) => {
              setLevels(l);
              setNeutralIndex(ni);
              setGoodIndex(gi);
              setVetoLevelId(veto);
            }}
          />
          <label className={`flex items-start gap-2 text-sm ${numericAxisReady ? 'text-gray-600 cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={continuous && numericAxisReady}
              disabled={!numericAxisReady}
              onChange={(e) => setContinuous(e.target.checked)}
            />
            <span>
              {t('Permitir desempenho contínuo — registar a medição exata em vez de escolher um nível')}
              {!numericAxisReady && (
                <span className="block text-xs text-gray-400 mt-0.5">
                  {t('Precisa de um valor numérico em cada nível: é esse eixo que dá sentido a uma posição entre dois níveis.')}
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800">{t('Guardar critério')}</button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">{t('Cancelar')}</button>
      </div>
    </div>
  );
}

const TYPE_ICON: Record<CritType, { Icon: typeof IconGate; cls: string }> = {
  gate: { Icon: IconGate, cls: 'bg-orange-50 text-orange-600' },
  qualification: { Icon: IconQualification, cls: 'bg-indigo-50 text-indigo-600' },
  composite: { Icon: IconComposite, cls: 'bg-emerald-50 text-emerald-600' },
};
const TYPE_TAG: Record<CritType, { label: string; cls: string }> = {
  composite: { label: 'Fator', cls: 'bg-indigo-100 text-indigo-700' },
  qualification: { label: 'Critério', cls: 'bg-sky-100 text-sky-700' },
  gate: { label: 'Eliminatória', cls: 'bg-rose-100 text-rose-700' },
};

export default function Criteria() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modelLabel, setModelLabel] = useState(model.label);
  const [importing, setImporting] = useState(false);
  // Reordering is confined to siblings of one group: cross-group moves would
  // silently invalidate both groups' weights, so they are rejected on drop.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; edge: 'top' | 'bottom' } | null>(null);
  const dialogs = useDialogs();

  const criteria = model.valueTree.criteria;
  const totalLeaves = Object.values(criteria).filter((c) => c.type !== 'composite').length;
  const factorCount = Object.values(criteria).filter((c) => c.type === 'composite').length;

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveNewCriterion(parentId: string, c: Criterion) {
    dispatch({ type: 'UPDATE_MODEL', patch: { valueTree: addChild(model.valueTree, parentId, c) } });
    setAddingUnder(null);
  }

  /**
   * Editing a descriptor changes the level ids a derived scale was built on, so
   * keeping the old scale would leave the model reporting a stale result as
   * consistent. Drop the scale and its matrix when the level set actually
   * changed — renaming a label alone is harmless and must not cost the user
   * their judgments.
   */
  async function saveEditCriterion(c: Criterion) {
    const before = criteria[c.id];
    const levelsOf = (x?: Criterion) =>
      x?.type === 'qualification' ? x.descriptor.levels.map((l) => l.id).join('|') : '';
    const anchorsOf = (x?: Criterion) =>
      x?.type === 'qualification' ? `${x.descriptor.neutralIndex}/${x.descriptor.goodIndex}` : '';
    const structureChanged =
      levelsOf(before) !== levelsOf(c) || anchorsOf(before) !== anchorsOf(c);

    const patch: Partial<EvaluationModel> = { valueTree: updateCriterion(model.valueTree, c) };
    if (structureChanged && model.derivedScales.some((s) => s.criterionId === c.id)) {
      const ok = await dialogs.confirm({
        title: t('A escala de «{{label}}» vai ser apagada', { label: c.label }),
        body: t('Os níveis mudaram, por isso a escala derivada deixa de corresponder ao descritor — mantê-la faria o modelo pontuar com valores que já não descrevem nada. Terá de responder outra vez às comparações deste critério.'),
        confirmLabel: t('Guardar e apagar a escala'),
        danger: true,
      });
      if (!ok) return;
      patch.derivedScales = model.derivedScales.filter((s) => s.criterionId !== c.id);
      patch.judgmentMatrices = model.judgmentMatrices.filter(
        (m) => !(m.kind === 'scale' && m.criterionId === c.id),
      );
    }
    dispatch({ type: 'UPDATE_MODEL', patch });
    setEditingId(null);
  }

  /**
   * Reuse a whole model as one factor of this one — build "Obsolescência
   * tecnológica" once, drop it into every architecture model. Ids are
   * regenerated on the way in so the same source can be imported repeatedly,
   * and derived scales travel with it (re-deriving them here would defeat the
   * point of reusing a finished model).
   */
  async function importAsFactor(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const doc = repository.parseDocument(await file.text());
      const source = doc.kind === 'evaluation' ? doc.model : doc;
      if (source.id === model.id) {
        await dialogs.alert({
          title: t('Não é possível importar um modelo para dentro de si próprio.'),
          body: t('Escolha um modelo diferente, ou exporte este primeiro e importe a cópia.'),
        });
        return;
      }
      if (source.valueTree.root.children.length === 0) {
        await dialogs.alert({ title: t('Esse modelo não tem critérios para importar.') });
        return;
      }
      dispatch({
        type: 'UPDATE_MODEL',
        patch: insertSubtree(model, ROOT_ID, source, uuidv4),
      });
    } catch (err) {
      await dialogs.alert({ title: t('Não foi possível importar esse ficheiro.'), body: String(err) });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function deleteCriterion(id: string) {
    const node = findNode(model.valueTree, id);
    const hasChildren = node && node.children.length > 0;
    const crit = criteria[id];
    const ok = await dialogs.confirm({
      title: hasChildren
        ? t('Eliminar «{{label}}» e os seus {{n}} subcritérios?', { label: crit?.label ?? '', n: node!.children.length })
        : t('Eliminar «{{label}}»?', { label: crit?.label ?? '' }),
      body: t('As escalas, juízos e pesos associados são apagados com ele. Não é possível anular.'),
      confirmLabel: t('Eliminar'),
      danger: true,
    });
    if (!ok) return;
    const tree = removeNode(model.valueTree, id);
    // Drop now-orphaned scales / matrices / sub-weights for removed criteria.
    const liveIds = new Set(Object.keys(tree.criteria));
    const subWeights = model.subWeights
      ? Object.fromEntries(Object.entries(model.subWeights).filter(([k]) => liveIds.has(k)))
      : undefined;
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        valueTree: tree,
        judgmentMatrices: model.judgmentMatrices.filter((m) => !m.criterionId || liveIds.has(m.criterionId)),
        derivedScales: model.derivedScales.filter((s) => liveIds.has(s.criterionId)),
        ...(subWeights ? { subWeights } : {}),
      },
    });
  }

  function moveNode(parentId: string, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    dispatch({
      type: 'UPDATE_MODEL',
      patch: { valueTree: reorderChild(model.valueTree, parentId, fromIndex, toIndex) },
    });
  }

  /** True when the dragged node is a sibling of `parentId` — the only legal drop. */
  function canDropIn(parentId: string): boolean {
    return dragId !== null && parentOf(model.valueTree, dragId) === parentId;
  }

  function handleDrop(parentId: string, targetIndex: number, edge: 'top' | 'bottom') {
    setDropAt(null);
    if (!dragId || !canDropIn(parentId)) return;
    const siblings = findNode(model.valueTree, parentId)?.children ?? [];
    const from = siblings.findIndex((s) => s.criterionId === dragId);
    setDragId(null);
    if (from < 0) return;
    // Target slot in the list *after* the dragged item is lifted out.
    let to = edge === 'bottom' ? targetIndex + 1 : targetIndex;
    if (from < to) to -= 1;
    moveNode(parentId, from, to);
  }

  function commitLabel() {
    if (modelLabel !== model.label) dispatch({ type: 'UPDATE_MODEL', patch: { label: modelLabel } });
  }

  async function exportModel() {
    await repository.saveModel({ ...model, label: modelLabel });
    const json = await repository.exportModel(model.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `choices-modelo-${model.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Recursive node renderer ──────────────────────────────────────────────
  function renderNode(node: ValueTreeNode, depth: number, parentId: string, index: number, siblingCount: number) {
    const c = criteria[node.criterionId];
    if (!c) return null;
    const tag = TYPE_TAG[c.type];
    const isComposite = c.type === 'composite';
    const isOpen = !collapsed.has(c.id);

    if (editingId === c.id) {
      return (
        <li key={c.id}>
          <CriterionForm initial={c} onSave={saveEditCriterion} onCancel={() => setEditingId(null)} />
        </li>
      );
    }

    const isDragging = dragId === c.id;
    const showTop = dropAt?.id === c.id && dropAt.edge === 'top';
    const showBottom = dropAt?.id === c.id && dropAt.edge === 'bottom';

    function onDragOver(e: React.DragEvent) {
      if (!dragId || dragId === c!.id || !canDropIn(parentId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const edge = e.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
      if (dropAt?.id !== c!.id || dropAt.edge !== edge) setDropAt({ id: c!.id, edge });
    }

    /** Keyboard equivalent of dragging, so reordering is not pointer-only. */
    function onHandleKeyDown(e: React.KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const to = index + (e.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= siblingCount) return;
      moveNode(parentId, index, to);
    }

    return (
      <li key={c.id} className="space-y-2">
        <div
          className="relative"
          onDragOver={onDragOver}
          onDragLeave={() => setDropAt((p) => (p?.id === c.id ? null : p))}
          onDrop={(e) => { e.preventDefault(); handleDrop(parentId, index, dropAt?.edge ?? 'top'); }}
        >
          {showTop && <div className="absolute -top-1 inset-x-0 h-0.5 rounded-full bg-blue-500 z-10" aria-hidden="true" />}
          {showBottom && <div className="absolute -bottom-1 inset-x-0 h-0.5 rounded-full bg-blue-500 z-10" aria-hidden="true" />}
        <div
          className={`flex items-start gap-3 flex-wrap p-3 border rounded-lg hover:border-gray-300 transition-opacity ${
            isComposite ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'
          } ${isDragging ? 'opacity-40' : ''}`}
        >
          {/* A span, not a button: form controls are unreliable drag sources in
              several browsers. role/tabIndex keep it operable from the keyboard. */}
          <span
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragId(null); setDropAt(null); }}
            onKeyDown={onHandleKeyDown}
            className="mt-1 text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing shrink-0 focus:outline-none focus:text-blue-600 focus:ring-2 focus:ring-blue-300 rounded"
            title={t('Arrastar para reordenar (ou ↑/↓ com o teclado)')}
            aria-label={t('Reordenar «{{label}}» — posição {{i}} de {{n}}', { label: c.label, i: index + 1, n: siblingCount })}
          >
            <IconGrip className="w-3.5 h-4" />
          </span>
          {isComposite ? (
            <button onClick={() => toggleCollapse(c.id)} className="text-gray-400 hover:text-gray-700 text-xs mt-1 w-3" aria-label={isOpen ? t('Colapsar') : t('Expandir')}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <span className={`mt-0.5 w-7 h-7 rounded-lg grid place-items-center shrink-0 ${TYPE_ICON[c.type].cls}`}>
            {(() => { const Ic = TYPE_ICON[c.type].Icon; return <Ic className="w-4 h-4" />; })()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tag.cls}`}>{t(tag.label)}</span>
              <p className="font-medium text-gray-800 truncate">{c.label}</p>
            </div>
            {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
            {c.type === 'qualification' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {t('{{n}} níveis · Neutro: «{{neutral}}» · Bom: «{{good}}»', {
                  n: c.descriptor.levels.length,
                  neutral: c.descriptor.levels[c.descriptor.neutralIndex]?.label,
                  good: c.descriptor.levels[c.descriptor.goodIndex]?.label,
                })}
                {c.continuous && t(' · contínuo')}
                {c.vetoLevelId && t(' · Veto: «{{veto}}»', { veto: c.descriptor.levels.find((l) => l.id === c.vetoLevelId)?.label })}
              </p>
            )}
            {c.type === 'gate' && (
              <p className="text-xs text-orange-700/80 mt-0.5">
                {t('Elimina a proposta inteira se não for cumprida — alcance global, não apenas neste fator.')}
              </p>
            )}
            {isComposite && (
              <p className="text-xs text-indigo-700/70 mt-0.5">{t('{{n}} subcritério(s)', { n: node.children.length })}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0 basis-full sm:basis-auto justify-end pl-10 sm:pl-0">
            {isComposite && (
              <button onClick={() => { setAddingUnder(c.id); setCollapsed((p) => { const n = new Set(p); n.delete(c.id); return n; }); }} className="px-2 py-1 text-xs text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-50">{t('+ subcritério')}</button>
            )}
            <button onClick={() => setEditingId(c.id)} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">{t('Editar')}</button>
            <button onClick={() => deleteCriterion(c.id)} className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">{t('Eliminar')}</button>
          </div>
        </div>
        </div>

        {/* Children (indented) */}
        {isComposite && isOpen && (
          <div className="ml-5 pl-3 border-l-2 border-indigo-100 space-y-2">
            {node.children.length > 0 && (
              <ul className="space-y-2">
                {node.children.map((ch, i) => renderNode(ch, depth + 1, c.id, i, node.children.length))}
              </ul>
            )}
            {addingUnder === c.id ? (
              <CriterionForm onSave={(nc) => saveNewCriterion(c.id, nc)} onCancel={() => setAddingUnder(null)} />
            ) : (
              <button onClick={() => setAddingUnder(c.id)} className="w-full py-2 border-2 border-dashed border-indigo-200 rounded-lg text-xs text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                {t('+ subcritério em «{{label}}»', { label: c.label })}
              </button>
            )}
          </div>
        )}
      </li>
    );
  }

  const rootChildren = model.valueTree.root.children;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label htmlFor="model-label" className="block text-xs text-gray-500 font-medium">{t('Designação do modelo')}</label>
          <input
            id="model-label"
            value={modelLabel}
            onChange={(e) => setModelLabel(e.target.value)}
            onBlur={commitLabel}
            className="w-full text-xl font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1"
          />
        </div>
        <button onClick={exportModel} className="px-3 py-1.5 mt-4 text-sm border border-gray-300 rounded hover:bg-gray-50 shrink-0">
          {t('Exportar modelo')}
        </button>
      </div>

      {/* The three types are the vocabulary everything downstream depends on,
          so they are defined in place rather than left to be inferred. */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 bg-indigo-50">
          <p className="text-sm font-bold text-indigo-700 mb-1">{t('Fator — agrupa')}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('Reúne outros elementos e reparte peso entre eles. A sua pontuação vem dos filhos. Pode conter outros fatores, sem limite de profundidade.')}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-sky-50">
          <p className="text-sm font-bold text-sky-700 mb-1">{t('Critério — mede')}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('O que se avalia. Tem níveis de desempenho ordenados, com duas referências fixas: Neutro = 0 e Bom = 100.')}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-rose-50">
          <p className="text-sm font-bold text-rose-700 mb-1">{t('Condição eliminatória')}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('Pergunta de sim/não. Se não for cumprida, a proposta é excluída sem ser pontuada — esteja onde estiver na estrutura.')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {t('Estrutura de avaliação')}
          <span className="ml-2 text-gray-400 font-normal normal-case">
            {factorCount > 0 ? t('{{n}} fator(es) · ', { n: factorCount }) : ''}{t('{{n}} folha(s)', { n: totalLeaves })}
          </span>
        </h2>

        {rootChildren.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            {t('Ainda sem critérios. Adicione um fator, um critério ou uma condição eliminatória.')}
          </p>
        )}

        <ul className="space-y-2">
          {rootChildren.map((ch, i) => renderNode(ch, 0, ROOT_ID, i, rootChildren.length))}
        </ul>

        {addingUnder === ROOT_ID ? (
          <CriterionForm onSave={(c) => saveNewCriterion(ROOT_ID, c)} onCancel={() => setAddingUnder(null)} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAddingUnder(ROOT_ID)} className="flex-1 min-w-[12rem] py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
              {t('+ Adicionar critério ou fator')}
            </button>
            <label
              className={`py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer text-center ${importing ? 'opacity-50 pointer-events-none' : ''}`}
              title={t('Reutilize um modelo inteiro — ex.: «Obsolescência tecnológica» — como um fator deste.')}
            >
              {importing ? t('A importar…') : t('↓ Importar modelo como fator')}
              <input type="file" accept=".json" className="hidden" onChange={importAsFactor} />
            </label>
          </div>
        )}
      </div>

      <ScreenNav
        next="weighting"
        nextLabel="Ponderação"
        hint="Com a estrutura definida, decida o que pesa mais — antes do trabalho detalhado das escalas."
        blockedBy={totalLeaves === 0 ? 'Adicione pelo menos um critério para continuar.' : undefined}
      />
    </div>
  );
}
