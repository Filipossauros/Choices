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
/**
 * A set of admissible ranges over one shared axis.
 *
 * The information on this screen *is* the width of each range, and that was
 * exactly what got the least room: an 85px bar against 180px of label and 250px
 * of numbers plus a badge. Worse, the bars had no axis and no ticks, so two
 * different lengths said nothing — you cannot read a position off a track whose
 * ends are not marked. And six of seven badges said "folgado", which made the
 * one that said "firme" invisible.
 *
 * So the bar gets the width, the axis gets marked, the rows sort from the most
 * undecided down, and the repeated badge gives way to the number it was standing
 * in for — with colour reserved for the rows that are actually pinned down.
 */
const TIGHT = 0.2;

function RangeChart({
  readings,
  domainMax,
  format,
}: {
  readings: RangeReading[];
  domainMax: number;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / domainMax) * 100))}%`;
  const rows = [...readings].sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const cols = 'grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_4.5rem] gap-3 items-center';

  return (
    <div>
      <div className={`${cols} text-[10px] font-mono text-gray-400 pb-1`}>
        <span />
        <span className="relative h-4">
          {ticks.map((f) => (
            <span
              key={f}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${f * 100}%` }}
            >
              {format(f * domainMax)}
            </span>
          ))}
        </span>
        <span className="text-right uppercase tracking-wider font-sans font-bold">{t('gama')}</span>
      </div>

      <div className="relative">
        {/* Grid lines sit behind the bars, inside the bar column only. */}
        <span className="absolute inset-y-0 left-[calc(10.5rem+0.75rem)] right-[calc(4.5rem+0.75rem)] pointer-events-none" aria-hidden="true">
          {ticks.map((f) => (
            <span key={f} className="absolute inset-y-0 w-px bg-gray-200" style={{ left: `${f * 100}%` }} />
          ))}
        </span>

        {rows.map((r) => {
          const span = r.hi - r.lo;
          const tight = span / domainMax <= TIGHT;
          return (
            <div key={r.id} className={`${cols} py-1 text-sm`}>
              <span className="truncate text-gray-600" title={r.label}>{r.label}</span>
              <span className="relative h-5 rounded-md bg-gray-100">
                <span
                  className={`absolute inset-y-0 rounded-md ${tight ? 'bg-green-400' : 'bg-indigo-300'}`}
                  style={{ left: pct(r.lo), width: `${Math.max(0, Math.min(100, (span / domainMax) * 100))}%` }}
                />
                <span
                  className="absolute top-1/2 w-[3px] h-3.5 rounded-sm bg-indigo-700 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: pct(r.central) }}
                  title={t('valor usado no cálculo')}
                />
              </span>
              <span className={`text-right font-mono text-xs tabular-nums ${tight ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
                {format(span)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 pt-3 mt-2 border-t border-gray-100 text-[11px] text-gray-400">
        <span><i className="inline-block w-4 h-2.5 rounded-sm bg-indigo-300 align-[-1px] mr-1.5" />{t('gama admissível')}</span>
        <span><i className="inline-block w-[3px] h-3 bg-indigo-700 align-[-2px] mr-1.5" />{t('valor usado no cálculo')}</span>
        <span><i className="inline-block w-4 h-2.5 rounded-sm bg-green-400 align-[-1px] mr-1.5" />{t('gama estreita — determinado')}</span>
      </div>
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
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">{t('O que ficou em aberto')}</h2>
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
              <RangeChart readings={robustness.weights} domainMax={1} format={(n) => n.toFixed(2)} />
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
              <RangeChart readings={robustness.scales.slice(0, 8)} domainMax={100} format={(n) => n.toFixed(0)} />
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
