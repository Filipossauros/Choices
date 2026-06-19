import { useApp } from '../store';
import { aggregate } from '../../engine/aggregation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const VERDICT_COLORS: Record<string, string> = {
  approved: '#16a34a',
  conditional: '#d97706',
  rejected: '#dc2626',
};

const VERDICT_LABELS: Record<string, string> = {
  approved: 'Recomendado',
  conditional: 'Recomendado com reservas',
  rejected: 'Não recomendado',
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    conditional: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[verdict] ?? 'bg-gray-100 text-gray-600'}`}>
      {VERDICT_LABELS[verdict] ?? verdict}
    </span>
  );
}

export default function Results() {
  const { state, dispatch } = useApp();
  const model = state.model!;

  function handleAggregate() {
    const result = aggregate(model);
    dispatch({ type: 'UPDATE_MODEL', patch: { aggregationResult: result } });
  }

  const result = model.aggregationResult;
  const isStale = result != null && (
    (model.weights?.derivedAt != null && model.weights.derivedAt > result.computedAt) ||
    model.derivedScales.some((s) => s.derivedAt > result.computedAt)
  );
  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-gray-500">
          Complete a ponderação e clique em «Calcular Resultados».
        </p>
        <button
          onClick={handleAggregate}
          className="px-6 py-3 bg-blue-700 text-white rounded-xl text-lg font-medium hover:bg-blue-800"
        >
          Calcular Resultados
        </button>
      </div>
    );
  }

  const sorted = [...result.optionResults].sort(
    (a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity),
  );

  const chartData = sorted.map((r) => ({
    name: model.options.find((o) => o.id === r.optionId)?.label ?? r.optionId,
    value: r.globalValue ?? 0,
    verdict: r.verdict,
    optionId: r.optionId,
  }));

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-800">Resultados da Avaliação</h2>
          {isStale && (
            <span className="text-xs text-amber-600 font-medium">
              ⚠ Pesos ou escalas alterados — recalcule
            </span>
          )}
        </div>
        <button
          onClick={handleAggregate}
          className="px-4 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800"
        >
          Recalcular
        </button>
      </div>

      {/* Ranking chart */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Valor Global V(p) — Modelo Aditivo
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[
                (dataMin: number) => Math.floor(Math.min(dataMin, result.conditionalThreshold) - 10),
                (dataMax: number) => Math.ceil(Math.max(dataMax, 100) + 5),
              ]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(v) => [`${v}`, 'V(p)']} />
            <ReferenceLine y={result.approvedThreshold} stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'Recomendado', fontSize: 10 }} />
            <ReferenceLine y={result.conditionalThreshold} stroke="#d97706" strokeDasharray="4 4" label={{ value: 'Com reservas', fontSize: 10 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={VERDICT_COLORS[entry.verdict] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">#</th>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">Proposta</th>
              <th className="px-4 py-2 text-right text-gray-600 font-medium">V(p)</th>
              <th className="px-4 py-2 text-center text-gray-600 font-medium">Recomendação</th>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r, i) => {
              const option = model.options.find((o) => o.id === r.optionId);
              return (
                <tr key={r.optionId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{option?.label ?? r.optionId}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                    {r.globalValue !== null ? r.globalValue.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <VerdictBadge verdict={r.verdict} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.rejectedByGate && (
                      <span>Porta: {model.valueTree.criteria[r.rejectedByGate]?.label}</span>
                    )}
                    {r.vetoedByCriterion && (
                      <span>Veto: {model.valueTree.criteria[r.vetoedByCriterion]?.label}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-criterion profile */}
      {qualCriteria.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Perfil por Critério</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-1.5 text-left text-gray-600 font-medium border border-gray-200">
                    Critério <span className="text-gray-400 font-normal">(peso)</span>
                  </th>
                  {sorted.map((r, rank) => (
                    <th key={r.optionId} className="px-3 py-1.5 text-center text-gray-600 font-medium border border-gray-200">
                      <span className="text-gray-400 text-xs mr-1">#{rank + 1}</span>
                      {model.options.find((o) => o.id === r.optionId)?.label ?? r.optionId}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualCriteria.map((c) => {
                  const weight = model.weights?.weights.find((w) => w.criterionId === c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-200 text-gray-700">
                        {c.label}
                        {weight && (
                          <span className="ml-1.5 text-xs text-gray-400 font-normal">
                            {(weight.weight * 100).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      {sorted.map((r) => {
                        const score = r.criterionScores[c.id];
                        const contrib = weight && score != null ? weight.weight * score : null;
                        return (
                          <td
                            key={r.optionId}
                            className="px-3 py-1.5 border border-gray-200 text-center font-mono text-sm"
                            title={contrib != null ? `Contribuição: ${contrib.toFixed(2)}` : undefined}
                          >
                            {score !== null && score !== undefined ? score.toFixed(1) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs">V(p) global</td>
                  {sorted.map((r) => (
                    <td key={r.optionId} className="px-3 py-1.5 border border-gray-200 text-center font-mono text-sm text-gray-800">
                      {r.globalValue !== null && r.globalValue !== undefined ? r.globalValue.toFixed(1) : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
