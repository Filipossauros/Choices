import { useState } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { Criterion, QualificationCriterion, GateCriterion, PerformanceLevel } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';

const DEFAULT_LEVELS = ['Excelente', 'Bom', 'Suficiente', 'Neutro', 'Insuficiente'];

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
    const newNeutral = Math.min(neutralIndex, next.length - 1);
    const newGood = Math.min(goodIndex, next.length - 1);
    onChange(next, newNeutral, newGood, vetoLevelId);
  }

  function updateLabel(i: number, label: string) {
    onChange(levels.map((l, j) => (j === i ? { ...l, label } : l)), neutralIndex, goodIndex, vetoLevelId);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[i], next[j]] = [next[j], next[i]];
    // update anchor indices if they moved
    let ni = neutralIndex === i ? j : neutralIndex === j ? i : neutralIndex;
    let gi = goodIndex === i ? j : goodIndex === j ? i : goodIndex;
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
            <input
              type="radio"
              name={`neutral-${levels[0]?.id}`}
              checked={neutralIndex === i}
              onChange={() => onChange(levels, i, goodIndex, vetoLevelId)}
            />
            Neutro
          </label>
          <label className="flex items-center gap-1 text-xs text-green-600 cursor-pointer">
            <input
              type="radio"
              name={`good-${levels[0]?.id}`}
              checked={goodIndex === i}
              onChange={() => onChange(levels, neutralIndex, i, vetoLevelId)}
            />
            Bom
          </label>
          <label className="flex items-center gap-1 text-xs text-orange-600 cursor-pointer" title="Veto: reprova abaixo deste nível">
            <input
              type="checkbox"
              checked={vetoLevelId === level.id}
              onChange={(e) => onChange(levels, neutralIndex, goodIndex, e.target.checked ? level.id : undefined)}
            />
            Veto
          </label>
          <button
            onClick={() => removeLevel(i)}
            className="text-red-400 hover:text-red-600 text-sm px-1"
            aria-label="Remover nível"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addLevel}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        + Adicionar nível
      </button>
    </div>
  );
}

function CriterionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Criterion;
  onSave: (c: Criterion) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<'gate' | 'qualification'>(initial?.type ?? 'qualification');

  const initQ = initial?.type === 'qualification' ? initial : null;
  const [levels, setLevels] = useState<PerformanceLevel[]>(
    initQ?.descriptor.levels ?? DEFAULT_LEVELS.map((l) => ({ id: uuidv4(), label: l })),
  );
  const [neutralIndex, setNeutralIndex] = useState(initQ?.descriptor.neutralIndex ?? 3);
  const [goodIndex, setGoodIndex] = useState(initQ?.descriptor.goodIndex ?? 1);
  const [vetoLevelId, setVetoLevelId] = useState<string | undefined>(initQ?.vetoLevelId);

  function handleSave() {
    if (!label.trim()) return alert('Introduza um nome para o critério.');
    const id = initial?.id ?? uuidv4();
    if (type === 'gate') {
      const c: GateCriterion = { id, label: label.trim(), description, type: 'gate' };
      onSave(c);
    } else {
      if (levels.length < 2) return alert('São necessários pelo menos 2 níveis.');
      const c: QualificationCriterion = {
        id,
        label: label.trim(),
        description,
        type: 'qualification',
        descriptor: { levels, neutralIndex, goodIndex },
        vetoLevelId,
      };
      onSave(c);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
            placeholder="Ex.: Disponibilidade, Segurança, Custo, Usabilidade…"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'gate'}
                onChange={() => setType('gate')}
              />
              <span className="text-sm">🚪 Porta (habilitação binária — cumpre/não cumpre)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'qualification'}
                onChange={() => setType('qualification')}
              />
              <span className="text-sm">📊 Qualificação (escala graduada)</span>
            </label>
          </div>
        </div>
      </div>

      {type === 'qualification' && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Descritor de Desempenho</p>
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
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800"
        >
          Guardar critério
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function Structuring() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [modelLabel, setModelLabel] = useState(model.label);

  const criteria = model.valueTree.criteria;
  const leafIds = model.valueTree.root.children.map((n) => n.criterionId);

  function saveCriterion(c: Criterion) {
    const updatedCriteria = { ...criteria, [c.id]: c };
    const updatedChildren = criteria[c.id]
      ? model.valueTree.root.children
      : [...model.valueTree.root.children, { criterionId: c.id, children: [] }];
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        valueTree: {
          ...model.valueTree,
          criteria: updatedCriteria,
          root: { ...model.valueTree.root, children: updatedChildren },
        },
      },
    });
    setEditingId(null);
    setShowNew(false);
  }

  function deleteCriterion(id: string) {
    if (!confirm('Eliminar este critério?')) return;
    const { [id]: _, ...rest } = criteria;
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        valueTree: {
          ...model.valueTree,
          criteria: rest,
          root: {
            ...model.valueTree.root,
            children: model.valueTree.root.children.filter((n) => n.criterionId !== id),
          },
        },
        judgmentMatrices: model.judgmentMatrices.filter((m) => m.criterionId !== id),
        derivedScales: model.derivedScales.filter((s) => s.criterionId !== id),
      },
    });
  }

  async function saveModel() {
    const updated = { ...model, label: modelLabel, updatedAt: new Date().toISOString() };
    dispatch({ type: 'SET_MODEL', model: updated });
    await repository.saveModel(updated);
    alert('Modelo guardado.');
  }

  async function exportModel() {
    await repository.saveModel(model);
    const json = await repository.exportModel(model.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escolhas-${model.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-gray-500 font-medium">Designação do modelo</label>
          <input
            value={modelLabel}
            onChange={(e) => setModelLabel(e.target.value)}
            className="w-full text-xl font-semibold border-0 border-b border-gray-200 focus:border-blue-400 outline-none pb-1"
          />
        </div>
        <div className="flex gap-2 shrink-0 pt-4">
          <button
            onClick={saveModel}
            className="px-3 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800"
          >
            Guardar
          </button>
          <button
            onClick={exportModel}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Exportar JSON
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Critérios ({leafIds.length})
          </h2>
          <div className="flex gap-2">
            <label className="text-sm text-gray-500">Recomendado ≥</label>
            <input
              type="number"
              min={0}
              max={100}
              value={model.approvedThreshold}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_MODEL',
                  patch: { approvedThreshold: Number(e.target.value) },
                })
              }
              className="w-16 border border-gray-200 rounded px-2 py-0.5 text-sm text-center"
            />
            <label className="text-sm text-gray-500">Com reservas ≥</label>
            <input
              type="number"
              min={0}
              max={100}
              value={model.conditionalThreshold}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_MODEL',
                  patch: { conditionalThreshold: Number(e.target.value) },
                })
              }
              className="w-16 border border-gray-200 rounded px-2 py-0.5 text-sm text-center"
            />
          </div>
        </div>

        {leafIds.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            Ainda sem critérios. Adicione pelo menos uma porta ou fator de qualificação.
          </p>
        )}

        <ul className="space-y-2">
          {leafIds.map((id) => {
            const c = criteria[id];
            if (!c) return null;
            return (
              <li key={id}>
                {editingId === id ? (
                  <CriterionForm
                    initial={c}
                    onSave={saveCriterion}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300">
                    <span className="text-lg">{c.type === 'gate' ? '🚪' : '📊'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{c.label}</p>
                      {c.description && (
                        <p className="text-xs text-gray-500">{c.description}</p>
                      )}
                      {c.type === 'qualification' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.descriptor.levels.length} níveis · Neutro: «{c.descriptor.levels[c.descriptor.neutralIndex]?.label}» · Bom: «{c.descriptor.levels[c.descriptor.goodIndex]?.label}»
                          {c.vetoLevelId && ` · Veto: «${c.descriptor.levels.find((l) => l.id === c.vetoLevelId)?.label}»`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditingId(id)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteCriterion(id)}
                        className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {showNew ? (
          <CriterionForm
            onSave={saveCriterion}
            onCancel={() => setShowNew(false)}
          />
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            + Adicionar critério
          </button>
        )}
      </div>

      <ScreenNav
        next="proposals"
        nextLabel="Propostas"
        hint="Defina os critérios antes de avançar."
        blockedBy={leafIds.length === 0 ? 'Adicione pelo menos um critério para continuar.' : undefined}
      />
    </div>
  );
}
