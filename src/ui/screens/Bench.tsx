/**
 * Banco de ensaio — trying the model out before it leaves the app.
 *
 * The app builds models that are applied elsewhere, so the author never sees
 * their model meet a real case. This screen is the substitute: write values by
 * hand, watch the level, the value, the weight and the contribution appear on
 * the same line, and see what the index does. Nothing here is a measurement and
 * the screen never pretends otherwise.
 *
 * Scoring goes through `runScenarios`, which goes through `aggregate` — the same
 * path the exported model takes. The scenarios double as test vectors for
 * whoever implements the model elsewhere.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../store';
import type {
  EvaluationModel,
  QualificationCriterion,
  TestScenario,
  Performance,
} from '../../domain/types';
import { qualificationCriteria } from '../../domain/tree';
import { modelReadiness } from '../../domain/tree';
import { downloadJson } from '../../domain/modelSpec';
import { runScenarios, buildTestVectors, type BenchResult, type BenchRow } from '../../engine/bench';
import {
  hasNumericAxis, numericPosition, positionToNumeric, nearestLevelId, levelPosition,
} from '../../engine/scaling';
import ScreenNav from '../components/ScreenNav';
import Why from '../components/Why';
import { useDialogs } from '../components/Dialog';

const fmt = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : n.toFixed(d);

/** Scenarios worth having in every model: the two that catch normalisation bugs. */
function starterScenarios(model: EvaluationModel): TestScenario[] {
  const quals = qualificationCriteria(model);
  const gates = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');
  const now = new Date().toISOString();
  const make = (id: string, label: string, pick: (c: QualificationCriterion) => string | undefined): TestScenario => ({
    id,
    label,
    updatedAt: now,
    performances: [
      ...quals.flatMap((c) => {
        const levelId = pick(c);
        return levelId ? [{ optionId: id, criterionId: c.id, value: levelId } as Performance] : [];
      }),
      ...gates.map((c) => ({ optionId: id, criterionId: c.id, value: 'pass' } as Performance)),
    ],
  });
  return [
    make(uuidv4(), 'Tudo no nível «bom»', (c) => c.descriptor.levels[c.descriptor.goodIndex]?.id),
    make(uuidv4(), 'Tudo no nível «neutro»', (c) => c.descriptor.levels[c.descriptor.neutralIndex]?.id),
  ];
}

export default function Bench() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const dialogs = useDialogs();
  const model = state.model!;
  const scenarios = useMemo(() => model.scenarios ?? [], [model.scenarios]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const readiness = modelReadiness(model);
  const results = useMemo(
    () => (readiness.ready || scenarios.length > 0 ? runScenarios(model, scenarios) : []),
    [model, scenarios, readiness.ready],
  );

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0] ?? null;
  const activeResult = results.find((r) => r.scenarioId === active?.id) ?? null;

  function patchScenarios(next: TestScenario[]) {
    dispatch({ type: 'UPDATE_MODEL', patch: { scenarios: next } });
  }

  function addScenario(from?: TestScenario) {
    const id = uuidv4();
    const next: TestScenario = from
      ? {
          ...structuredClone(from),
          id,
          label: t('{{label}} (cópia)', { label: from.label }),
          performances: from.performances.map((p) => ({ ...p, optionId: id })),
          updatedAt: new Date().toISOString(),
        }
      : { id, label: t('Cenário {{n}}', { n: scenarios.length + 1 }), performances: [], updatedAt: new Date().toISOString() };
    patchScenarios([...scenarios, next]);
    setActiveId(id);
  }

  async function removeScenario(s: TestScenario) {
    const ok = await dialogs.confirm({
      title: t('Apagar «{{label}}»?', { label: s.label }),
      body: t('O cenário e os valores que escreveu nele desaparecem. O modelo não é afectado.'),
      confirmLabel: t('Apagar'),
      danger: true,
    });
    if (!ok) return;
    patchScenarios(scenarios.filter((x) => x.id !== s.id));
    setActiveId(null);
  }

  function setPerf(scenario: TestScenario, criterionId: string, perf: Performance | null) {
    const rest = scenario.performances.filter((p) => p.criterionId !== criterionId);
    const next: TestScenario = {
      ...scenario,
      performances: perf ? [...rest, perf] : rest,
      updatedAt: new Date().toISOString(),
    };
    patchScenarios(scenarios.map((s) => (s.id === scenario.id ? next : s)));
  }

  function rename(scenario: TestScenario, label: string) {
    patchScenarios(scenarios.map((s) => (s.id === scenario.id ? { ...s, label } : s)));
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <header className="space-y-1.5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-800">{t('Banco de ensaio')}</h2>
          <p className="text-sm text-gray-500">
            {t('Escreva valores à mão e veja o que o modelo faz com eles.')}
          </p>
          <Why label="para que serve?">
            <p>
              {t('Este modelo vai ser aplicado noutro lado — não aqui. O ensaio é a forma de o experimentar antes de o exportar: escreve um valor, vê o nível que lhe é atribuído, o valor MACBETH, o peso e a contribuição para o índice.')}
            </p>
            <p>
              {t('Os cenários também são exportados como vectores de ensaio: quem implementar o modelo corre os mesmos valores e compara. Se um número diferir, a implementação está errada — não o modelo.')}
            </p>
            <p className="text-gray-500">
              {t('Dois cenários valem sempre a pena: «tudo no neutro», que tem de dar exactamente 0, e um colocado em cima de um limiar de zona. São os que apanham erros de normalização e de arredondamento.')}
            </p>
          </Why>
        </div>
      </header>

      {!readiness.ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('O modelo ainda não está completo, por isso o ensaio não produz índice.')}{' '}
          {readiness.pendingScales.length > 0 && (
            <span>{t('Faltam escalas: {{list}}.', { list: readiness.pendingScales.join(', ') })} </span>
          )}
          {!readiness.weightsReady && <span>{t('Faltam pesos.')} </span>}
          <span className="text-amber-700">
            {t('Pode escrever os cenários na mesma — ficam à espera.')}
          </span>
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
          <p className="text-gray-500 text-sm">{t('Ainda não há cenários.')}</p>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            {t('Um cenário é uma alternativa fictícia descrita por si, para experimentar o modelo. Não é uma medição e nunca é apresentada como tal.')}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={() => patchScenarios(starterScenarios(model))}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-strong"
            >
              {t('Começar com dois cenários')}
            </button>
            <button
              onClick={() => addScenario()}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {t('Cenário vazio')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {scenarios.map((s) => {
              const r = results.find((x) => x.scenarioId === s.id);
              const on = s.id === active?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    on ? 'border-accent bg-accent/10 text-accent-strong font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                  <span className="ml-2 font-mono text-xs text-gray-400">
                    {r?.blocked ? t('bloqueado') : r?.globalValue != null ? fmt(r.globalValue) : '—'}
                  </span>
                </button>
              );
            })}
            <button onClick={() => addScenario()} className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">
              + {t('Cenário')}
            </button>
          </div>

          {active && (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem] gap-5 items-start">
              {/* min-w-0: without it the grid child takes the table's intrinsic
                  width and the whole page scrolls sideways on a phone. */}
              <div className="space-y-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={active.label}
                    onChange={(e) => rename(active, e.target.value)}
                    aria-label={t('Nome do cenário')}
                    className="flex-1 min-w-[12rem] border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-100 text-amber-800">
                    {t('valores escritos à mão')}
                  </span>
                  <button onClick={() => addScenario(active)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                    {t('Duplicar')}
                  </button>
                  <button onClick={() => removeScenario(active)} className="px-2.5 py-1.5 text-sm rounded-lg text-rose-500 hover:bg-rose-50">
                    ✕
                  </button>
                </div>

                <ScenarioTable
                  model={model}
                  scenario={active}
                  result={activeResult}
                  onChange={(critId, perf) => setPerf(active, critId, perf)}
                />
              </div>

              <aside className="space-y-4">
                <ResultCard result={activeResult} />
                <VectorsCard model={model} scenarios={scenarios} />
              </aside>
            </div>
          )}

          <ScenarioComparison results={results} />
        </>
      )}

      <ScreenNav next="summary" nextLabel="Resumo" hint="Os cenários ficam guardados no modelo e saem no pacote como vectores de ensaio." />
    </div>
  );
}

// ─── The trace table ─────────────────────────────────────────────────────────

function ScenarioTable({
  model, scenario, result, onChange,
}: {
  model: EvaluationModel;
  scenario: TestScenario;
  result: BenchResult | null;
  onChange: (criterionId: string, perf: Performance | null) => void;
}) {
  const { t } = useTranslation();
  const rowById = new Map((result?.rows ?? []).map((r) => [r.criterionId, r]));
  const perfById = new Map(scenario.performances.map((p) => [p.criterionId, p]));
  const quals = qualificationCriteria(model);
  const gates = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-800">{t('O que escreve → o que o modelo faz com isso')}</h3>
        <span className="ml-auto text-xs text-gray-400">{t('recalcula a cada alteração')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2 text-left font-semibold">{t('Critério')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('Valor que escreve')}</th>
              <th className="px-3 py-2 text-left font-semibold">{t('Nível atribuído')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('Valor')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('Peso')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('Contribuição')}</th>
            </tr>
          </thead>
          <tbody>
            {quals.map((c) => {
              const row = rowById.get(c.id);
              const perf = perfById.get(c.id);
              return (
                <tr key={c.id} className={`border-t border-gray-100 ${row?.blank ? 'bg-amber-50/60' : ''}`}>
                  <td className="px-3 py-2 font-medium text-gray-800">{c.label}</td>
                  <td className="px-3 py-2">
                    <PerformanceInput crit={c} perf={perf} onChange={(p) => onChange(c.id, p)} />
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {row?.levelLabel ?? (
                      <span className="text-amber-700 text-xs">{t('não atribuído')}</span>
                    )}
                    {row?.position != null && (
                      <span className="block text-[10px] text-gray-400 font-mono">
                        {t('posição {{p}}', { p: row.position.toFixed(2) })}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${(row?.value ?? 0) < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                    {fmt(row?.value)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-400">
                    {row?.weight != null ? `${(row.weight * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${(row?.contribution ?? 0) < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                    {row?.contribution != null ? (row.contribution > 0 ? '+' : '') + fmt(row.contribution) : '—'}
                  </td>
                </tr>
              );
            })}

            {gates.map((c) => {
              const row = rowById.get(c.id);
              const verdict = perfById.get(c.id)?.value ?? '';
              return (
                <tr key={c.id} className="border-t border-gray-100 bg-orange-50/40">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {c.label}
                    <span className="block text-[10px] text-gray-400">{t('condição eliminatória')}</span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={verdict}
                      aria-label={c.label}
                      onChange={(e) =>
                        onChange(c.id, e.target.value ? { optionId: scenario.id, criterionId: c.id, value: e.target.value } : null)
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">—</option>
                      <option value="pass">{t('Cumpre')}</option>
                      <option value="fail">{t('Não cumpre')}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {row?.verdict === 'fail'
                      ? t('Falha — bloqueia a classificação')
                      : row?.verdict === 'pass'
                        ? t('Cumpre')
                        : t('por responder')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">n/a</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">n/a</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-rose-600">
                    {row?.verdict === 'fail' ? t('bloqueia') : ''}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t-2 border-gray-200 bg-accent/5">
              <td colSpan={5} className="px-3 py-2.5 font-semibold text-gray-800">
                {t('Índice do cenário')} <span className="font-mono text-xs text-gray-400">V = Σ kᵢ · vᵢ</span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-bold text-accent-strong text-base">
                {result?.globalValue != null ? fmt(result.globalValue) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {result && result.missing.length > 0 && (
        <p className="px-4 py-3 border-t border-gray-100 text-xs text-amber-800 bg-amber-50">
          {t('Sem índice: {{list}} por preencher. O valor em falta não é convertido em zero nem em neutro, e os pesos não são renormalizados — o índice fica retido até o cenário estar completo.', {
            list: result.missing.map((m) => m.label).join(', '),
          })}
        </p>
      )}
    </div>
  );
}

function PerformanceInput({
  crit, perf, onChange,
}: {
  crit: QualificationCriterion;
  perf: Performance | undefined;
  onChange: (perf: Performance | null) => void;
}) {
  const { t } = useTranslation();
  const optionId = perf?.optionId ?? '';

  if (crit.continuous && hasNumericAxis(crit.descriptor)) {
    const pos = perf?.position ?? (perf?.value ? levelPosition(crit.descriptor, perf.value) : null);
    const shown = perf?.measured ?? (pos != null ? positionToNumeric(crit.descriptor, pos) : null);
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          value={shown ?? ''}
          placeholder="—"
          aria-label={crit.label}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            const p = numericPosition(crit.descriptor, n);
            if (p == null) return;
            onChange({
              optionId,
              criterionId: crit.id,
              value: nearestLevelId(crit.descriptor, p) ?? '',
              position: p,
              measured: n,
            });
          }}
          className="w-24 text-sm text-right border border-gray-200 rounded px-2 py-1"
        />
        {crit.descriptor.unit && <span className="text-[10px] text-gray-400">{crit.descriptor.unit}</span>}
      </span>
    );
  }

  return (
    <select
      value={perf?.value ?? ''}
      aria-label={crit.label}
      onChange={(e) =>
        onChange(e.target.value ? { optionId, criterionId: crit.id, value: e.target.value } : null)
      }
      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white max-w-[12rem]"
    >
      <option value="">{t('— em branco')}</option>
      {crit.descriptor.levels.map((l) => (
        <option key={l.id} value={l.id}>{l.label}</option>
      ))}
    </select>
  );
}

// ─── Side panels ─────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: BenchResult | null }) {
  const { t } = useTranslation();
  if (!result) return null;
  const shown = result.globalValue ?? result.indicativeValue;

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t('Resultado deste cenário')}</p>
      <div className="flex items-end gap-3">
        <span className={`font-mono font-bold text-4xl tracking-tight ${result.blocked ? 'text-gray-400' : 'text-gray-800'}`}>
          {shown != null ? fmt(shown) : '—'}
        </span>
        {result.band && !result.blocked && (
          <span
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
            style={{ backgroundColor: `${result.band.color}22`, color: result.band.color }}
          >
            {result.band.label}
          </span>
        )}
      </div>

      {result.blocked && result.blockedBy && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 leading-relaxed">
          <strong className="block mb-0.5">
            {result.blockedBy.kind === 'gate' ? t('Condição eliminatória em falha') : t('Veto accionado')}
          </strong>
          {t('«{{label}}» impede a classificação: nenhum bom resultado noutro critério a compensa.', { label: result.blockedBy.label })}
          {result.indicativeValue != null && (
            <span className="block mt-1.5 text-rose-700">
              {t('Teria ficado em {{v}}', { v: fmt(result.indicativeValue) })}
              {result.wouldBeBand && t(' — zona «{{band}}»', { band: result.wouldBeBand.label })}
              {t('. Mostrado por ser informativo, nunca usado como classificação.')}
            </span>
          )}
        </div>
      )}

      {result.pendingGates.length > 0 && !result.blocked && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          {t('Classificação provisória: {{list}} por responder.', { list: result.pendingGates.map((g) => g.label).join(', ') })}
        </p>
      )}

      <Contributions rows={result.rows} />
    </div>
  );
}

function Contributions({ rows }: { rows: BenchRow[] }) {
  const { t } = useTranslation();
  const scored = rows.filter((r) => r.contribution != null);
  if (scored.length === 0) return null;
  const max = Math.max(...scored.map((r) => Math.abs(r.contribution!)), 1);
  const sorted = [...scored].sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!));

  return (
    <div className="pt-1 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t('Contribuições')}</p>
      {sorted.map((r) => {
        const v = r.contribution!;
        return (
          <div key={r.criterionId}>
            <div className="flex justify-between text-xs text-gray-600">
              <span className="truncate pr-2">{r.label}</span>
              <span className={`font-mono font-semibold ${v < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                {v > 0 ? '+' : ''}{fmt(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${v < 0 ? 'bg-rose-400' : 'bg-emerald-500'}`}
                style={{ width: `${(Math.abs(v) / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VectorsCard({ model, scenarios }: { model: EvaluationModel; scenarios: TestScenario[] }) {
  const { t } = useTranslation();
  return (
    <div className="border border-accent/40 rounded-xl bg-accent/[0.04] p-4 space-y-2.5">
      <h3 className="text-sm font-semibold text-gray-800">{t('Vectores de ensaio')}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">
        {t('Cada cenário sai como entradas + resultados esperados. Quem implementar este modelo corre os mesmos cenários e compara — se um número diferir, a implementação está errada, não o modelo.')}
      </p>
      <button
        onClick={() => downloadJson(`choices-ensaios-${model.id.slice(0, 8)}.json`, buildTestVectors(model, scenarios))}
        className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-strong"
      >
        ↓ {t('Exportar {{n}} vector(es)', { n: scenarios.length })}
      </button>
    </div>
  );
}

function ScenarioComparison({ results }: { results: BenchResult[] }) {
  const { t } = useTranslation();
  if (results.length < 2) return null;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <h3 className="text-sm font-semibold text-gray-800 px-4 py-2.5 border-b border-gray-100">
        {t('Todos os cenários')}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left font-semibold">{t('Cenário')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('Índice')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('Zona')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('Estado')}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scenarioId} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-800">{r.label}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">
                  {r.globalValue != null ? fmt(r.globalValue) : r.blocked && r.indicativeValue != null ? (
                    <span className="text-gray-400 line-through">{fmt(r.indicativeValue)}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2">
                  {r.band && !r.blocked ? (
                    <span className="text-xs font-medium" style={{ color: r.band.color }}>{r.band.label}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {r.blocked
                    ? t('bloqueado por «{{label}}»', { label: r.blockedBy?.label ?? '' })
                    : r.missing.length > 0
                      ? t('{{n}} critério(s) por preencher', { n: r.missing.length })
                      : t('completo')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
