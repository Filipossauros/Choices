import { useApp } from '../store';
import { sortBands } from '../../domain/decision';
import type { DecisionBand } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';

export default function DecisionScale() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const bands = model.decisionScale;
  const sorted = sortBands(bands);

  function update(next: DecisionBand[]) {
    dispatch({ type: 'UPDATE_MODEL', patch: { decisionScale: next } });
  }
  function patchBand(id: string, patch: Partial<DecisionBand>) {
    update(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function addBand() {
    const min = sorted.length ? Math.max(0, sorted[0].minScore + 10) : 50;
    update([...bands, { id: uuidv4(), label: 'Novo ponto de decisão', minScore: min, color: '#6366f1' }]);
  }
  function removeBand(id: string) {
    update(bands.filter((b) => b.id !== id));
  }

  // Visual band preview over a [min, 100] axis
  const top = Math.max(100, ...sorted.map((b) => b.minScore));
  const bottom = Math.min(0, ...sorted.map((b) => b.minScore));
  const span = top - bottom || 1;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-800">Escala de decisão</h2>
        <p className="text-sm text-gray-500">
          Defina os pontos de tomada de decisão com base na pontuação final V(p). Cada banda aplica-se
          a partir do seu limiar inferior (inclusive) até ao limiar da banda seguinte. Dê-lhes nomes
          (ex.: «Reprovar», «Aprovar de forma condicionada», «Aprovar»).
        </p>
      </div>

      {/* Preview */}
      <div className="flex gap-4">
        <div className="relative w-10 shrink-0" style={{ height: 220 }}>
          {[0, 25, 50, 75, 100].filter((t) => t >= bottom && t <= top).map((t) => (
            <span
              key={t}
              className="absolute right-0 text-[10px] text-gray-400 font-mono -translate-y-1/2"
              style={{ top: ((top - t) / span) * 220 }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1 rounded-lg overflow-hidden border border-gray-200" style={{ height: 220 }}>
          {sorted.map((b, i) => {
            const upper = i === 0 ? top : sorted[i - 1].minScore;
            const hTop = ((top - upper) / span) * 220;
            const hBot = ((top - b.minScore) / span) * 220;
            return (
              <div
                key={b.id}
                className="absolute left-0 right-0 flex items-center px-3 text-sm font-medium text-white"
                style={{ top: hTop, height: Math.max(0, hBot - hTop), backgroundColor: b.color }}
              >
                <span className="truncate drop-shadow-sm">{b.label}</span>
                <span className="ml-auto font-mono text-xs opacity-90">≥ {b.minScore}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        {sorted.map((b) => (
          <div key={b.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-white">
            <input
              type="color"
              value={b.color}
              onChange={(e) => patchBand(b.id, { color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-gray-200"
              title="Cor"
            />
            <input
              value={b.label}
              onChange={(e) => patchBand(b.id, { label: e.target.value })}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Nome do ponto de decisão"
            />
            <label className="text-xs text-gray-500 whitespace-nowrap">V(p) ≥</label>
            <input
              type="number"
              value={b.minScore}
              onChange={(e) => patchBand(b.id, { minScore: Number(e.target.value) })}
              className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center font-mono"
            />
            <button
              onClick={() => removeBand(b.id)}
              disabled={bands.length <= 1}
              className="text-red-400 hover:text-red-600 disabled:opacity-20 text-sm px-1"
              aria-label="Remover banda"
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={addBand} className="text-sm text-blue-600 hover:text-blue-800">+ Adicionar ponto de decisão</button>
      </div>

      <ScreenNav
        next="scales"
        nextLabel="Escalas"
        hint="Pode ajustar a escala de decisão a qualquer momento."
        blockedBy={bands.length === 0 ? 'Defina pelo menos um ponto de decisão.' : undefined}
      />
    </div>
  );
}
