import { useState } from 'react';
import { useApp } from '../store';
import type { MacbethJudgment, JudgmentMatrix } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { deriveWeights, ALL_NEUTRAL } from '../../engine/weighting';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import { v4 as uuidv4 } from 'uuid';

export default function Weighting() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [deriving, setDeriving] = useState(false);

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );

  const weightingMatrix: JudgmentMatrix =
    model.judgmentMatrices.find((m) => m.kind === 'weighting') ?? {
      id: uuidv4(),
      kind: 'weighting',
      assessorId: DEFAULT_ASSESSOR_ID,
      judgments: {},
      updatedAt: new Date().toISOString(),
    };

  function updateJudgments(judgments: Record<string, MacbethJudgment>) {
    const updated: JudgmentMatrix = {
      ...weightingMatrix,
      judgments,
      updatedAt: new Date().toISOString(),
    };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        judgmentMatrices: [
          ...model.judgmentMatrices.filter((m) => m.kind !== 'weighting'),
          updated,
        ],
      },
    });
  }

  async function handleDerive() {
    setDeriving(true);
    try {
      const weights = await deriveWeights(
        qualCriteria.map((c) => c.id),
        weightingMatrix.judgments,
      );
      dispatch({ type: 'UPDATE_MODEL', patch: { weights } });
    } finally {
      setDeriving(false);
    }
  }

  if (qualCriteria.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Sem critérios de qualificação. Defina-os na Estruturação.</p>
      </div>
    );
  }

  // Items for the matrix: criteria + all-neutral reference
  const matrixItems = [
    ...qualCriteria.map((c) => ({ id: c.id, label: c.label })),
    { id: ALL_NEUTRAL, label: 'Tudo-Neutro (ref.)' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">Ponderação por Oscilação (Swing Weighting)</p>
        <p>
          Compare a atratividade de oscilar cada critério de <em>Neutro</em> para <em>Bom</em>.
          A referência «Tudo-Neutro» é o ponto de partida (valor = 0).
        </p>
        <p className="text-xs text-blue-600">
          ⚠️ O peso de cada critério reflecte a amplitude real do seu descritor (Neutro→Bom).
          Descritores com amplitudes muito diferentes distorcem a comparação.
        </p>
      </div>

      <JudgmentMatrixEditor
        items={matrixItems}
        judgments={weightingMatrix.judgments}
        onChange={updateJudgments}
      />

      <button
        onClick={handleDerive}
        disabled={deriving || Object.keys(weightingMatrix.judgments).length === 0}
        className="px-5 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
      >
        {deriving ? 'A calcular pesos…' : 'Calcular pesos'}
      </button>

      {model.weights && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Pesos Derivados (normalizados Σ = 1)</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              model.weights.consistencyMargin > 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              z = {model.weights.consistencyMargin.toFixed(4)}
            </span>
          </div>
          <div className="space-y-2">
            {model.weights.weights.map((w) => {
              const crit = model.valueTree.criteria[w.criterionId];
              return (
                <div key={w.criterionId} className="flex items-center gap-3">
                  <span className="w-40 text-sm truncate text-gray-700" title={crit?.label}>
                    {crit?.label ?? w.criterionId}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div
                      className="h-4 rounded-full bg-blue-500"
                      style={{ width: `${(w.weight * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm font-mono font-medium">
                    {(w.weight * 100).toFixed(1)}%
                  </span>
                  <span className="w-36 text-xs text-gray-400 font-mono">
                    [{(w.admissibleRange[0] * 100).toFixed(1)}%, {(w.admissibleRange[1] * 100).toFixed(1)}%]
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-3">
        <p className="flex-1 text-xs text-gray-400">
          O modelo está completo. Aplique-o para registar propostas e obter resultados.
        </p>
        <button
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!model.weights || model.weights.consistencyMargin <= 0}
          title={!model.weights || model.weights.consistencyMargin <= 0 ? 'Calcule pesos consistentes antes de aplicar.' : undefined}
          onClick={() => dispatch({ type: 'START_EVALUATION', model })}
        >
          Aplicar este modelo →
        </button>
      </div>
    </div>
  );
}
