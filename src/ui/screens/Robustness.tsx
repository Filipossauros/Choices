/**
 * Robustez — the model-phase counterpart to results sensitivity.
 *
 * Sensitivity asks "at which weight does the ranking of proposals flip?", which
 * needs proposals and therefore lives in the apply flow. This screen asks a
 * different question — "how much freedom did my judgments leave open?" — which
 * needs only the model, and reads the admissible ranges both LPs already
 * compute but that were previously almost invisible.
 */
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { modelRobustness, modelReadiness, type RangeReading } from '../../domain/tree';
import { resolveBands } from '../../engine/aggregation';
import { sortBands } from '../../domain/decision';
import ScreenNav from '../components/ScreenNav';

/** A range bar: the admissible interval as a band, the optimum as a dot. */
function RangeBar({
  reading,
  domainMax,
  format,
}: {
  reading: RangeReading;
  domainMax: number;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / domainMax) * 100))}%`;
  const width = Math.max(0, Math.min(100, ((reading.hi - reading.lo) / domainMax) * 100));

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex-[0_0_11rem] text-right text-gray-500 truncate" title={reading.label}>
        {reading.label}
      </span>
      <span className="flex-1 h-7 rounded-lg bg-gray-100 relative overflow-hidden">
        <span
          className="absolute inset-y-0 bg-indigo-100 border-x-2 border-indigo-500"
          style={{ left: pct(reading.lo), width: `${width}%` }}
        />
        <span
          className="absolute top-1/2 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(reading.central) }}
        />
      </span>
      <span className="flex-[0_0_7rem] text-right font-mono text-xs text-gray-400 tabular-nums">
        {format(reading.lo)} – {format(reading.hi)}
      </span>
      <span
        className={`flex-[0_0_4.5rem] text-center text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${
          reading.loose ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
        }`}
      >
        {reading.loose ? t('folgado') : t('firme')}
      </span>
    </div>
  );
}

export default function Robustness() {
  const { t } = useTranslation();
  const { state } = useApp();
  const model = state.model!;

  const readiness = modelReadiness(model);
  const robustness = modelRobustness(model);

  // Band cut-offs move with the weights, so their spread is part of robustness.
  const resolved = sortBands(resolveBands(model));
  const nonBase = resolved.slice(0, -1);

  const loosest = [...robustness.weights].sort((a, b) => b.slack - a.slack)[0];
  const pct = Math.round(robustness.determination * 100);

  if (!readiness.scalesReady && !readiness.weightsReady) {
    return (
      <div className="max-w-2xl mx-auto py-14 px-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-2">
          <h2 className="text-base font-semibold text-blue-900">{t('Ainda não há nada para medir')}</h2>
          <p className="text-sm text-blue-800">
            {t('A robustez lê as gamas admissíveis calculadas na Ponderação e nas Escalas. Complete pelo menos um desses passos e volte aqui.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">{t('Robustez do modelo')}</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
          {t('Quanta liberdade os seus juízos deixaram em aberto. Cada barra mostra o intervalo de valores que continuam compatíveis com o que respondeu — quanto mais estreito, mais o modelo está determinado. Não precisa de propostas: isto olha só para o modelo.')}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="space-y-5">
          {robustness.weights.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t('Pesos — valor central e gama admissível')}
              </h3>
              <div className="space-y-3">
                {robustness.weights.map((w) => (
                  <RangeBar key={w.id} reading={w} domainMax={1} format={(n) => n.toFixed(2)} />
                ))}
              </div>
              {loosest?.loose && (
                <p className="text-xs text-gray-500 leading-relaxed pt-2 border-t border-gray-100">
                  {t('«{{label}}» tem a gama mais larga: os juízos dados não o fixam bem. Se essa incerteza importar, responda a mais uma comparação que o envolva.', { label: loosest.label })}
                </p>
              )}
            </div>
          )}

          {nonBase.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t('Limiares de decisão')}
              </h3>
              <div className="space-y-2">
                {nonBase.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="flex-1 truncate text-gray-700">{b.label}</span>
                    <span className="font-mono text-sm font-bold tabular-nums" style={{ color: b.color }}>
                      ≥ {b.minScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pt-2 border-t border-gray-100">
                {t('Os limiares derivados de um perfil deslocam-se quando os pesos ou as escalas mudam — reveja-os se a gama dos pesos acima for larga.')}
              </p>
            </div>
          )}

          {robustness.scales.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t('Níveis de desempenho não ancorados')}
              </h3>
              <div className="space-y-3">
                {robustness.scales.slice(0, 8).map((s) => (
                  <RangeBar key={s.id} reading={s} domainMax={100} format={(n) => n.toFixed(0)} />
                ))}
              </div>
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                {t('Neutro e Bom não aparecem: estão fixos em 0 e 100 por construção.')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {t('Grau de determinação')}
            </h3>
            <div className="text-4xl font-bold tracking-tight text-indigo-600 font-mono tabular-nums mt-3 mb-1">
              {pct}<span className="text-xl text-gray-400">%</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t('Os seus juízos fixam {{pct}}% do espaço de modelos compatíveis. O resto é liberdade que ficou por decidir.', { pct })}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Escalas consistentes')}</span>
                <span className={`font-mono font-bold ${readiness.scalesReady ? 'text-green-600' : 'text-amber-600'}`}>
                  {readiness.pendingScales.length === 0 ? t('todas') : t('{{n}} por derivar', { n: readiness.pendingScales.length })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Grupos ponderados')}</span>
                <span className={`font-mono font-bold ${readiness.weightsReady ? 'text-green-600' : 'text-amber-600'}`}>
                  {readiness.weightsReady ? t('todos') : t('incompleto')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('Limiares fundamentados')}</span>
                <span className="font-mono font-bold text-gray-600">
                  {nonBase.filter((b) => b.referenceProfile && !b.manualThreshold).length} / {nonBase.length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800 leading-relaxed">
            <strong>{t('Porque é que isto vem antes de aplicar?')}</strong>{' '}
            {t('Esta análise olha só para o modelo. A sensibilidade do ranking — a que peso as propostas trocam de posição — precisa de propostas e por isso vive no fluxo de aplicação.')}
          </div>
        </div>
      </div>

      <ScreenNav
        next="summary"
        nextLabel="Resumo"
        hint="Veja a síntese do modelo (fórmula, pesos) e exporte para JSON / IA."
      />
    </div>
  );
}
