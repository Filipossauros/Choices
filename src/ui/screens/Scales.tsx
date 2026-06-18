import { useState } from 'react';
import { useApp } from '../store';
import type { MacbethJudgment, JudgmentMatrix, DerivedScale } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { deriveScale } from '../../engine/scaling';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import { v4 as uuidv4 } from 'uuid';

export default function Scales() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [derivingId, setDerivingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );

  function getMatrix(criterionId: string): JudgmentMatrix {
    return (
      model.judgmentMatrices.find(
        (m) => m.kind === 'scale' && m.criterionId === criterionId,
      ) ?? {
        id: uuidv4(),
        kind: 'scale',
        criterionId,
        assessorId: DEFAULT_ASSESSOR_ID,
        judgments: {},
        updatedAt: new Date().toISOString(),
      }
    );
  }

  function updateMatrix(criterionId: string, judgments: Record<string, MacbethJudgment>) {
    const existing = model.judgmentMatrices.find(
      (m) => m.kind === 'scale' && m.criterionId === criterionId,
    );
    const updated: JudgmentMatrix = existing
      ? { ...existing, judgments, updatedAt: new Date().toISOString() }
      : {
          id: uuidv4(),
          kind: 'scale',
          criterionId,
          assessorId: DEFAULT_ASSESSOR_ID,
          judgments,
          updatedAt: new Date().toISOString(),
        };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        judgmentMatrices: [
          ...model.judgmentMatrices.filter(
            (m) => !(m.kind === 'scale' && m.criterionId === criterionId),
          ),
          updated,
        ],
      },
    });
  }

  async function handleDerive(criterionId: string) {
    const crit = model.valueTree.criteria[criterionId];
    if (crit?.type !== 'qualification') return;
    const matrix = getMatrix(criterionId);
    setDerivingId(criterionId);
    try {
      const scale = await deriveScale(criterionId, crit.descriptor, matrix);
      dispatch({
        type: 'UPDATE_MODEL',
        patch: {
          derivedScales: [
            ...model.derivedScales.filter((s) => s.criterionId !== criterionId),
            scale,
          ],
        },
      });
    } finally {
      setDerivingId(null);
    }
  }

  function getScale(criterionId: string): DerivedScale | undefined {
    return model.derivedScales.find((s) => s.criterionId === criterionId);
  }

  if (qualCriteria.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Sem critérios de qualificação definidos.</p>
      </div>
    );
  }

  const activeCrit = selected
    ? qualCriteria.find((c) => c.id === selected) ?? qualCriteria[0]
    : qualCriteria[0];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex gap-6">
      {/* Sidebar */}
      <div className="w-48 shrink-0 space-y-1">
        {qualCriteria.map((c) => {
          const scale = getScale(c.id);
          const isActive = activeCrit?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className="block truncate">{c.label}</span>
              {scale ? (() => {
                const matrix = model.judgmentMatrices.find(
                  (m) => m.kind === 'scale' && m.criterionId === c.id,
                );
                const stale = matrix && matrix.updatedAt > scale.derivedAt;
                return stale ? (
                  <span className="text-xs text-amber-600">⚠ Desatualizada</span>
                ) : scale.consistencyMargin > 0 ? (
                  <span className="text-xs text-green-600">✓ Derivada</span>
                ) : (
                  <span className="text-xs text-red-500">✗ Inconsistente</span>
                );
              })() : (
                <span className="text-xs text-gray-400">Por derivar</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main area */}
      {activeCrit && activeCrit.type === 'qualification' && (
        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{activeCrit.label}</h2>
            <button
              onClick={() => handleDerive(activeCrit.id)}
              disabled={derivingId === activeCrit.id}
              className="px-4 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {derivingId === activeCrit.id ? 'A derivar…' : 'Derivar escala'}
            </button>
          </div>

          <JudgmentMatrixEditor
            items={activeCrit.descriptor.levels}
            judgments={getMatrix(activeCrit.id).judgments}
            onChange={(j) => updateMatrix(activeCrit.id, j)}
          />

          {/* Scale display */}
          {getScale(activeCrit.id) && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Escala Derivada</h3>
              <div className="space-y-2">
                {getScale(activeCrit.id)!.values.map((sv) => {
                  const level = activeCrit.descriptor.levels.find(
                    (l) => l.id === sv.levelId,
                  );
                  const isNeutral =
                    activeCrit.descriptor.levels[activeCrit.descriptor.neutralIndex]?.id === sv.levelId;
                  const isGood =
                    activeCrit.descriptor.levels[activeCrit.descriptor.goodIndex]?.id === sv.levelId;
                  const barWidth = Math.max(0, Math.min(100, sv.value));
                  return (
                    <div key={sv.levelId} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-32 text-sm text-gray-700 truncate" title={level?.label}>
                          {level?.label}
                          {isNeutral && <span className="ml-1 text-xs text-gray-400">(N)</span>}
                          {isGood && <span className="ml-1 text-xs text-gray-400">(B)</span>}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                          <div
                            className="h-4 rounded-full bg-blue-400"
                            style={{ width: `${Math.max(0, barWidth)}%` }}
                          />
                          {sv.value < 0 && (
                            <div
                              className="h-4 absolute top-0 rounded-full bg-red-300"
                              style={{
                                right: '50%',
                                width: `${Math.min(50, Math.abs(sv.value) / 2)}%`,
                              }}
                            />
                          )}
                        </div>
                        <span className="w-16 text-right text-sm font-mono font-medium">
                          {sv.value.toFixed(1)}
                        </span>
                        <span className="w-28 text-xs text-gray-400">
                          [{sv.admissibleRange[0].toFixed(1)}, {sv.admissibleRange[1].toFixed(1)}]
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">
                Margem de consistência: {getScale(activeCrit.id)!.consistencyMargin.toFixed(4)} ·{' '}
                Intervalo admissível preserva a consistência dos juízos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
