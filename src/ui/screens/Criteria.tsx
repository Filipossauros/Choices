import { useState } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type {
  Criterion,
  QualificationCriterion,
  GateCriterion,
  CompositeCriterion,
  PerformanceLevel,
  ValueTreeNode,
} from '../../domain/types';
import { ROOT_ID } from '../../domain/types';
import { addChild, updateCriterion, removeNode, findNode } from '../../domain/tree';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';

const DEFAULT_LEVELS = ['Excelente', 'Bom', 'Suficiente', 'Neutro', 'Insuficiente'];

type CritType = 'gate' | 'qualification' | 'composite';

function LevelEditor({
  levels,
  neutralIndex,
  goodIndex,
  vetoLevelId,
  onChange,
}: {
  levels: PerformanceLevel[];
  neutralIndex: number;
  goodIndex: number;
  vetoLevelId?: string;
  onChange: (levels: PerformanceLevel[], neutralIndex: number, goodIndex: number, vetoLevelId?: string) => void;
}) {
  function addLevel() {
    onChange([...levels, { id: uuidv4(), label: 'Novo nível' }], neutralIndex, goodIndex, vetoLevelId);
  }
  function removeLevel(i: number) {
    const next = levels.filter((_, j) => j !== i);
    onChange(next, Math.min(neutralIndex, next.length - 1), Math.min(goodIndex, next.length - 1), vetoLevelId);
  }
  function updateLabel(i: number, label: string) {
    onChange(levels.map((l, j) => (j === i ? { ...l, label } : l)), neutralIndex, goodIndex, vetoLevelId);
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

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 italic">Ordenados do mais para o menos atrativo (↑ = melhor)</p>
      {levels.map((level, i) => (
        <div key={level.id} className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === levels.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▼</button>
          </div>
          <input
            value={level.label}
            onChange={(e) => updateLabel(i, e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
            placeholder="Descrição do nível"
          />
          <label className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer">
            <input type="radio" name={`neutral-${levels[0]?.id}`} checked={neutralIndex === i} onChange={() => onChange(levels, i, goodIndex, vetoLevelId)} />
            Neutro
          </label>
          <label className="flex items-center gap-1 text-xs text-green-600 cursor-pointer">
            <input type="radio" name={`good-${levels[0]?.id}`} checked={goodIndex === i} onChange={() => onChange(levels, neutralIndex, i, vetoLevelId)} />
            Bom
          </label>
          <label className="flex items-center gap-1 text-xs text-orange-600 cursor-pointer" title="Veto: reprova abaixo deste nível">
            <input type="checkbox" checked={vetoLevelId === level.id} onChange={(e) => onChange(levels, neutralIndex, goodIndex, e.target.checked ? level.id : undefined)} />
            Veto
          </label>
          <button onClick={() => removeLevel(i)} className="text-red-400 hover:text-red-600 text-sm px-1" aria-label="Remover nível">✕</button>
        </div>
      ))}
      <button onClick={addLevel} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
        + Adicionar nível
      </button>
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
  const [label, setLabel] = useState(initial?.label ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<CritType>(initial?.type ?? 'qualification');

  const initQ = initial?.type === 'qualification' ? initial : null;
  const [levels, setLevels] = useState<PerformanceLevel[]>(
    initQ?.descriptor.levels ?? DEFAULT_LEVELS.map((l) => ({ id: uuidv4(), label: l })),
  );
  const [neutralIndex, setNeutralIndex] = useState(initQ?.descriptor.neutralIndex ?? 3);
  const [goodIndex, setGoodIndex] = useState(initQ?.descriptor.goodIndex ?? 1);
  const [vetoLevelId, setVetoLevelId] = useState<string | undefined>(initQ?.vetoLevelId);
  const [continuous, setContinuous] = useState<boolean>(initQ?.continuous ?? false);

  function handleSave() {
    if (!label.trim()) return alert('Introduza um nome para o critério.');
    const id = initial?.id ?? uuidv4();
    if (type === 'gate') {
      onSave({ id, label: label.trim(), description, type: 'gate' } as GateCriterion);
    } else if (type === 'composite') {
      onSave({ id, label: label.trim(), description, type: 'composite' } as CompositeCriterion);
    } else {
      if (levels.length < 2) return alert('São necessários pelo menos 2 níveis.');
      onSave({
        id,
        label: label.trim(),
        description,
        type: 'qualification',
        descriptor: { levels, neutralIndex, goodIndex },
        vetoLevelId,
        continuous,
      } as QualificationCriterion);
    }
  }

  // A criterion that already has children can only stay a composite.
  const lockedComposite = initial?.type === 'composite';

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder="Ex.: Segurança, Latência, Custo…" autoFocus />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <div className="flex flex-wrap gap-4">
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'composite'} disabled={lockedComposite && type !== 'composite'} onChange={() => setType('composite')} />
              <span className="text-sm">🗂️ Fator composto (decompõe em subcritérios)</span>
            </label>
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'qualification'} disabled={lockedComposite} onChange={() => setType('qualification')} />
              <span className="text-sm">📊 Qualificação (escala graduada)</span>
            </label>
            <label className={`flex items-center gap-2 ${lockedComposite ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type="radio" checked={type === 'gate'} disabled={lockedComposite} onChange={() => setType('gate')} />
              <span className="text-sm">🚪 Porta (habilitação binária)</span>
            </label>
          </div>
          {lockedComposite && (
            <p className="text-xs text-gray-400 mt-1">Este fator tem subcritérios. Remova-os para mudar o tipo.</p>
          )}
        </div>
      </div>

      {type === 'composite' && (
        <p className="text-sm text-gray-500 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          Um fator composto agrega os seus subcritérios por ponderação. Depois de o guardar, use «+ subcritério»
          para o decompor. A sua pontuação é calculada a partir dos filhos.
        </p>
      )}

      {type === 'qualification' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Descritor de Desempenho</p>
          <LevelEditor
            levels={levels}
            neutralIndex={neutralIndex}
            goodIndex={goodIndex}
            vetoLevelId={vetoLevelId}
            onChange={(l, ni, gi, veto) => {
              setLevels(l);
              setNeutralIndex(ni);
              setGoodIndex(gi);
              setVetoLevelId(veto);
            }}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />
            Permitir desempenho contínuo (posição entre níveis, lida da curva suave)
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800">Guardar critério</button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  );
}

const TYPE_ICON: Record<CritType, string> = { gate: '🚪', qualification: '📊', composite: '🗂️' };
const TYPE_TAG: Record<CritType, { label: string; cls: string }> = {
  composite: { label: 'FATOR', cls: 'bg-emerald-100 text-emerald-700' },
  qualification: { label: 'QUALIF.', cls: 'bg-indigo-100 text-indigo-700' },
  gate: { label: 'PORTA', cls: 'bg-orange-100 text-orange-700' },
};

export default function Criteria() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modelLabel, setModelLabel] = useState(model.label);

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

  function saveEditCriterion(c: Criterion) {
    dispatch({ type: 'UPDATE_MODEL', patch: { valueTree: updateCriterion(model.valueTree, c) } });
    setEditingId(null);
  }

  function deleteCriterion(id: string) {
    const node = findNode(model.valueTree, id);
    const hasChildren = node && node.children.length > 0;
    if (!confirm(hasChildren ? 'Eliminar este fator e todos os seus subcritérios?' : 'Eliminar este critério?')) return;
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
  function renderNode(node: ValueTreeNode, depth: number) {
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

    return (
      <li key={c.id} className="space-y-2">
        <div
          className={`flex items-start gap-3 p-3 border rounded-lg hover:border-gray-300 ${
            isComposite ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-gray-200'
          }`}
        >
          {isComposite ? (
            <button onClick={() => toggleCollapse(c.id)} className="text-gray-400 hover:text-gray-700 text-xs mt-1 w-3" aria-label={isOpen ? 'Colapsar' : 'Expandir'}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <span className="text-lg leading-none mt-0.5">{TYPE_ICON[c.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tag.cls}`}>{tag.label}</span>
              <p className="font-medium text-gray-800 truncate">{c.label}</p>
            </div>
            {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
            {c.type === 'qualification' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {c.descriptor.levels.length} níveis · Neutro: «{c.descriptor.levels[c.descriptor.neutralIndex]?.label}» · Bom: «{c.descriptor.levels[c.descriptor.goodIndex]?.label}»
                {c.continuous && ' · contínuo'}
                {c.vetoLevelId && ` · Veto: «${c.descriptor.levels.find((l) => l.id === c.vetoLevelId)?.label}»`}
              </p>
            )}
            {isComposite && (
              <p className="text-xs text-emerald-700/70 mt-0.5">{node.children.length} subcritério(s)</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {isComposite && (
              <button onClick={() => { setAddingUnder(c.id); setCollapsed((p) => { const n = new Set(p); n.delete(c.id); return n; }); }} className="px-2 py-1 text-xs text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50">+ subcritério</button>
            )}
            <button onClick={() => setEditingId(c.id)} className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">Editar</button>
            <button onClick={() => deleteCriterion(c.id)} className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">Eliminar</button>
          </div>
        </div>

        {/* Children (indented) */}
        {isComposite && isOpen && (
          <div className="ml-5 pl-3 border-l-2 border-emerald-100 space-y-2">
            {node.children.length > 0 && (
              <ul className="space-y-2">{node.children.map((ch) => renderNode(ch, depth + 1))}</ul>
            )}
            {addingUnder === c.id ? (
              <CriterionForm onSave={(nc) => saveNewCriterion(c.id, nc)} onCancel={() => setAddingUnder(null)} />
            ) : (
              <button onClick={() => setAddingUnder(c.id)} className="w-full py-2 border-2 border-dashed border-emerald-200 rounded-lg text-xs text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
                + subcritério em «{c.label}»
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
          <label className="block text-xs text-gray-500 font-medium">Designação do modelo</label>
          <input
            value={modelLabel}
            onChange={(e) => setModelLabel(e.target.value)}
            onBlur={commitLabel}
            className="w-full text-xl font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1"
          />
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs text-gray-500">O modelo avalia:</span>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="subjectKind"
                checked={(model.subjectKind ?? 'proposals') === 'proposals'}
                onChange={() => dispatch({ type: 'UPDATE_MODEL', patch: { subjectKind: 'proposals' } })}
              />
              <span>Propostas (ex.: arquitetura)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="subjectKind"
                checked={model.subjectKind === 'positions'}
                onChange={() => dispatch({ type: 'UPDATE_MODEL', patch: { subjectKind: 'positions' } })}
              />
              <span>Posições / momentos (monitorização)</span>
            </label>
          </div>
        </div>
        <button onClick={exportModel} className="px-3 py-1.5 mt-4 text-sm border border-gray-300 rounded hover:bg-gray-50 shrink-0">
          Exportar modelo
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Árvore de critérios
          <span className="ml-2 text-gray-400 font-normal normal-case">
            {factorCount > 0 ? `${factorCount} fator(es) · ` : ''}{totalLeaves} folha(s)
          </span>
        </h2>

        {rootChildren.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            Ainda sem critérios. Adicione um fator composto, um critério de qualificação ou uma porta.
          </p>
        )}

        <ul className="space-y-2">{rootChildren.map((ch) => renderNode(ch, 0))}</ul>

        {addingUnder === ROOT_ID ? (
          <CriterionForm onSave={(c) => saveNewCriterion(ROOT_ID, c)} onCancel={() => setAddingUnder(null)} />
        ) : (
          <button onClick={() => setAddingUnder(ROOT_ID)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
            + Adicionar critério ou fator
          </button>
        )}
      </div>

      <ScreenNav
        next="scales"
        nextLabel="Escalas"
        hint="Defina os critérios antes de avançar."
        blockedBy={totalLeaves === 0 ? 'Adicione pelo menos um critério para continuar.' : undefined}
      />
    </div>
  );
}
