/**
 * Consequências — the rules that say what a result costs.
 *
 * Three layers, kept apart on purpose and said so on the screen: the
 * multicriteria model says how *good* the performance was, the decision zones
 * say what that *means*, and these rules say what it *costs*. Changing anything
 * here changes the amount and leaves the index exactly where it was.
 *
 * The app does not apply these rules to anything real — it writes them, and
 * shows what they produce on an invented incident so the author can see the
 * effect of what they just typed. The rules travel in the exported package;
 * whoever runs the model applies them.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import type {
  EvaluationModel, PenaltyRules, TestIncident, DecisionBand,
} from '../../domain/types';
import { qualificationCriteria } from '../../domain/tree';
import { sortBands } from '../../domain/decision';
import { resolveBands } from '../../engine/aggregation';
import { runScenarios } from '../../engine/bench';
import { computePenalties, defaultPenaltyRules, severityBandFor } from '../../engine/penalty';
import ScreenNav from '../components/ScreenNav';
import Why from '../components/Why';
import { useDialogs } from '../components/Dialog';

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);

export default function Penalties() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const dialogs = useDialogs();
  const model = state.model!;
  const rules = model.penaltyRules;

  function setRules(patch: Partial<PenaltyRules>) {
    if (!rules) return;
    dispatch({ type: 'UPDATE_MODEL', patch: { penaltyRules: { ...rules, ...patch } } });
  }

  if (!rules) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-4 text-center">
        <h2 className="text-lg font-semibold text-gray-800">{t('Consequências')}</h2>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          {t('Alguns modelos não terminam numa classificação: a zona em que o resultado cai tem consequências com custo — penalizações contratuais, por exemplo. Se for o caso deste modelo, defina-as aqui.')}
        </p>
        <p className="text-xs text-gray-400 max-w-xl mx-auto">
          {t('Nenhum montante entra nas funções de valor MACBETH. As regras vivem à parte e viajam no pacote exportado.')}
        </p>
        <button
          onClick={() => dispatch({ type: 'UPDATE_MODEL', patch: { penaltyRules: defaultPenaltyRules(model) } })}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-strong"
        >
          {t('Definir regras de consequência')}
        </button>
        <div className="pt-4"><ScreenNav next="bench" nextLabel="Banco de ensaio" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <header className="space-y-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-800">{t('Consequências')}</h2>
          <p className="text-sm text-gray-500">
            {t('Mudar um valor aqui muda o montante — e deixa o índice exactamente onde estava.')}
          </p>
          <Why label="porquê em camadas?">
            <p>
              <strong>{t('Avaliação multicritério')}</strong> {t('diz quanto vale o desempenho (0–100, neutro–bom).')}{' '}
              <strong>{t('Zonas de decisão')}</strong> {t('dizem o que isso significa.')}{' '}
              <strong>{t('Estas regras')}</strong> {t('dizem quanto custa.')}
            </p>
            <p>
              {t('As duas últimas consomem a primeira; nenhuma delas lhe altera os números. O único ponto em que o índice toca no montante é o multiplicador de zona — e o cálculo mostra-o como um passo próprio.')}
            </p>
            <p className="text-gray-500">
              {t('A gravidade de um incidente é lida dos factos do próprio incidente, não da escala de valor do critério: um critério pode estar em nível aceitável no conjunto e ainda assim ter tido um incidente grave.')}
            </p>
          </Why>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <label className="text-xs text-gray-500">{t('Versão das regras')}</label>
          <input
            value={rules.version}
            onChange={(e) => setRules({ version: e.target.value })}
            className="w-28 border border-gray-200 rounded px-2 py-1 text-sm font-mono"
          />
          <label className="text-xs text-gray-500 ml-2">{t('Moeda')}</label>
          <input
            value={rules.currency}
            onChange={(e) => setRules({ currency: e.target.value.toUpperCase().slice(0, 3) })}
            className="w-16 border border-gray-200 rounded px-2 py-1 text-sm font-mono"
          />
          <button
            onClick={async () => {
              const ok = await dialogs.confirm({
                title: t('Remover as regras de consequência?'),
                body: t('O modelo volta a terminar na classificação por zonas. As regras e os montantes que escreveu desaparecem; os critérios, escalas e pesos ficam intactos.'),
                confirmLabel: t('Remover'),
                danger: true,
              });
              if (ok) dispatch({ type: 'UPDATE_MODEL', patch: { penaltyRules: undefined } });
            }}
            className="ml-auto text-xs text-rose-500 hover:text-rose-600"
          >
            {t('Remover regras')}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <ZonesCard model={model} rules={rules} setRules={setRules} />
        <SeverityCard rules={rules} setRules={setRules} />
        <AccumulationCard rules={rules} setRules={setRules} />
      </div>

      <BaseAmountsCard model={model} rules={rules} setRules={setRules} />
      <Walkthrough model={model} rules={rules} />

      <ScreenNav next="bench" nextLabel="Banco de ensaio" hint="As regras viajam no pacote exportado. Experimente-as num cenário antes de exportar." />
    </div>
  );
}

// ─── Rule editors ────────────────────────────────────────────────────────────

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-gray-200 rounded-xl bg-white">
      <h3 className="text-sm font-semibold text-gray-800 px-4 py-2.5 border-b border-gray-100">{title}</h3>
      <div className="p-4 space-y-3">
        {children}
        {hint && <p className="text-xs text-gray-400 leading-relaxed">{hint}</p>}
      </div>
    </section>
  );
}

function NumberCell({
  value, onChange, suffix, width = 'w-24',
}: { value: number; onChange: (n: number) => void; suffix?: string; width?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        step="any"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`${width} text-right font-mono text-sm border border-gray-200 rounded px-2 py-1`}
      />
      {suffix && <span className="text-[10px] text-gray-400">{suffix}</span>}
    </span>
  );
}

function ZonesCard({ model, rules, setRules }: { model: EvaluationModel; rules: PenaltyRules; setRules: (p: Partial<PenaltyRules>) => void }) {
  const { t } = useTranslation();
  const bands = sortBands(resolveBands(model));
  return (
    <Card
      title={t('Multiplicador por zona')}
      hint={t('É o único ponto em que o índice entra no montante. Uma zona a ×0 não gera penalização nenhuma.')}
    >
      <table className="w-full text-sm">
        <tbody>
          {bands.map((b) => (
            <tr key={b.id}>
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: b.color }} />
                  <span className="text-gray-700">{b.label}</span>
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-gray-400">≥ {b.minScore.toFixed(1)}</td>
              <td className="py-1.5 text-right">
                <NumberCell
                  value={rules.zoneMultipliers[b.id] ?? 1}
                  width="w-20"
                  onChange={(n) => setRules({ zoneMultipliers: { ...rules.zoneMultipliers, [b.id]: n } })}
                  suffix="×"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SeverityCard({ rules, setRules }: { rules: PenaltyRules; setRules: (p: Partial<PenaltyRules>) => void }) {
  const { t } = useTranslation();
  const bands = [...rules.severityBands].sort((a, b) => a.minSeverity - b.minSeverity);
  return (
    <Card
      title={t('Faixas de gravidade')}
      hint={t('G vem dos factos do incidente — duração, impacto —, não da escala de valor do critério. São duas leituras independentes do mesmo facto.')}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
            <th className="text-left pb-1">{t('Faixa')}</th>
            <th className="text-right pb-1">{t('G ≥')}</th>
            <th className="text-right pb-1">{t('Isenta')}</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.id}>
              <td className="py-1">
                <input
                  value={b.label}
                  onChange={(e) =>
                    setRules({ severityBands: rules.severityBands.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })
                  }
                  className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-1 py-0.5 text-sm"
                />
              </td>
              <td className="py-1 text-right">
                <NumberCell
                  value={b.minSeverity}
                  width="w-16"
                  onChange={(n) =>
                    setRules({ severityBands: rules.severityBands.map((x) => (x.id === b.id ? { ...x, minSeverity: n } : x)) })
                  }
                />
              </td>
              <td className="py-1 text-right">
                <input
                  type="checkbox"
                  checked={!!b.exempt}
                  aria-label={t('Isenta')}
                  onChange={(e) =>
                    setRules({ severityBands: rules.severityBands.map((x) => (x.id === b.id ? { ...x, exempt: e.target.checked } : x)) })
                  }
                  className="accent-accent"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AccumulationCard({ rules, setRules }: { rules: PenaltyRules; setRules: (p: Partial<PenaltyRules>) => void }) {
  const { t } = useTranslation();
  const critical = rules.criticalRegime ?? { amount: 0, enabled: false };
  return (
    <Card title={t('Acumulação, reincidência e tectos')}>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={rules.commonCauseNoAccumulation}
          onChange={(e) => setRules({ commonCauseNoAccumulation: e.target.checked })}
          className="mt-0.5 accent-accent"
        />
        <span>
          <span className="font-medium text-gray-700">{t('Causa comum não acumula')}</span>
          <span className="block text-xs text-gray-400">{t('Incidentes com a mesma causa-raiz contam uma vez — o de maior gravidade.')}</span>
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={rules.recurrence.enabled}
          onChange={(e) => setRules({ recurrence: { ...rules.recurrence, enabled: e.target.checked } })}
          className="mt-0.5 accent-accent"
        />
        <span className="flex-1">
          <span className="font-medium text-gray-700">{t('Reincidência')}</span>
          {rules.recurrence.enabled && (
            <span className="block text-xs text-gray-500 mt-1 space-x-1">
              <span>{t('2.ª')}</span>
              <NumberCell value={rules.recurrence.secondFactor} width="w-16" suffix="×"
                onChange={(n) => setRules({ recurrence: { ...rules.recurrence, secondFactor: n } })} />
              <span>{t('3.ª+')}</span>
              <NumberCell value={rules.recurrence.furtherFactor} width="w-16" suffix="×"
                onChange={(n) => setRules({ recurrence: { ...rules.recurrence, furtherFactor: n } })} />
              <span>{t('janela')}</span>
              <NumberCell value={rules.recurrence.windowDays} width="w-16" suffix={t('dias')}
                onChange={(n) => setRules({ recurrence: { ...rules.recurrence, windowDays: n } })} />
            </span>
          )}
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={critical.enabled}
          onChange={(e) => setRules({ criticalRegime: { ...critical, enabled: e.target.checked } })}
          className="mt-0.5 accent-accent"
        />
        <span className="flex-1">
          <span className="font-medium text-gray-700">{t('Regime crítico')}</span>
          <span className="block text-xs text-gray-400">{t('Condição eliminatória em falha: montante fixo, em substituição do cálculo proporcional.')}</span>
          {critical.enabled && (
            <span className="block mt-1">
              <NumberCell value={critical.amount} suffix={rules.currency}
                onChange={(n) => setRules({ criticalRegime: { ...critical, amount: n } })} />
            </span>
          )}
        </span>
      </label>

      <div className="flex items-center gap-2 text-sm pt-1 border-t border-gray-100">
        <span className="flex-1 text-gray-700">{t('Tecto do período')}</span>
        <NumberCell value={rules.periodCap ?? 0} suffix={rules.currency}
          onChange={(n) => setRules({ periodCap: n > 0 ? n : undefined })} />
      </div>
    </Card>
  );
}

function BaseAmountsCard({ model, rules, setRules }: { model: EvaluationModel; rules: PenaltyRules; setRules: (p: Partial<PenaltyRules>) => void }) {
  const { t } = useTranslation();
  const quals = qualificationCriteria(model);
  const byCrit = new Map(rules.criterionRules.map((r) => [r.criterionId, r]));

  function upsert(criterionId: string, patch: Partial<(typeof rules.criterionRules)[number]>) {
    const cur = byCrit.get(criterionId);
    const next = cur
      ? rules.criterionRules.map((r) => (r.criterionId === criterionId ? { ...r, ...patch } : r))
      : [...rules.criterionRules, { criterionId, baseAmount: 0, ...patch }];
    setRules({ criterionRules: next });
  }

  return (
    <section className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800">{t('Montantes-base por critério')}</h3>
        <span className="text-xs text-gray-400">{t('por incidente, antes de qualquer factor')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-mono uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left font-semibold">{t('Critério')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('Base')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('Faixa mínima')}</th>
              <th className="px-4 py-2 text-right font-semibold">{t('Tecto/incidente')}</th>
              <th className="px-4 py-2 text-left font-semibold">{t('Fundamento')}</th>
            </tr>
          </thead>
          <tbody>
            {quals.map((c) => {
              const r = byCrit.get(c.id);
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{c.label}</td>
                  <td className="px-4 py-2 text-right">
                    <NumberCell value={r?.baseAmount ?? 0} suffix={rules.currency}
                      onChange={(n) => upsert(c.id, { baseAmount: n })} />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={r?.minSeverityBandId ?? ''}
                      aria-label={t('Faixa mínima')}
                      onChange={(e) => upsert(c.id, { minSeverityBandId: e.target.value || undefined })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">{t('qualquer')}</option>
                      {rules.severityBands.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <NumberCell value={r?.perIncidentCap ?? 0} suffix={rules.currency}
                      onChange={(n) => upsert(c.id, { perIncidentCap: n > 0 ? n : undefined })} />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r?.reference ?? ''}
                      placeholder={t('cláusula…')}
                      onChange={(e) => upsert(c.id, { reference: e.target.value || undefined })}
                      className="w-28 text-xs border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-1.5 py-1"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {quals.length === 0 && (
        <p className="px-4 py-4 text-xs text-gray-400">{t('O modelo ainda não tem critérios de qualificação.')}</p>
      )}
    </section>
  );
}

// ─── The worked example ──────────────────────────────────────────────────────

/**
 * An invented incident, walked through the rules step by step. It is the
 * fastest way for the author to see what the numbers they just typed produce —
 * and the only way to notice a rule that is never reached, since the steps that
 * did not fire stay in the trace, greyed out.
 */
function Walkthrough({ model, rules }: { model: EvaluationModel; rules: PenaltyRules }) {
  const { t } = useTranslation();
  const scenarios = model.scenarios ?? [];
  const quals = qualificationCriteria(model);
  const [scenarioId, setScenarioId] = useState<string>('');
  const [severity, setSeverity] = useState(78);
  const [criterionId, setCriterionId] = useState<string>(quals[0]?.id ?? '');
  const [occurrence, setOccurrence] = useState(1);

  const results = useMemo(() => runScenarios(model, scenarios), [model, scenarios]);
  const chosen = results.find((r) => r.scenarioId === scenarioId) ?? results[0] ?? null;
  const band: DecisionBand | null = chosen?.band ?? null;

  const incidents: TestIncident[] = criterionId
    ? [{ id: 'walk', label: t('Incidente de ensaio'), criterionId, severity, occurrence }]
    : [];

  const penalty = useMemo(
    () =>
      computePenalties({
        rules,
        incidents,
        band,
        gateFailed: chosen?.blockedBy?.kind === 'gate',
        gateLabel: chosen?.blockedBy?.label,
        labelOf: (id) => model.valueTree.criteria[id]?.label ?? id,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, criterionId, severity, occurrence, band, chosen],
  );

  const line = penalty.lines.find((l) => l.incidentId === 'walk');
  const sevBand = severityBandFor(severity, rules);

  return (
    <section className="border border-accent/40 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-accent/[0.06] border-b border-accent/20 flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800">{t('Ensaio do cálculo')}</h3>
        <span className="text-xs text-gray-500">{t('do incumprimento ao montante, passo a passo')}</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-100 text-amber-800">
          {t('incidente inventado')}
        </span>
      </div>

      <div className="p-4 grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-5 items-start">
        <div>
          <div className="flex items-center gap-2 flex-wrap text-sm pb-3 mb-1 border-b border-gray-100">
            <label className="text-xs text-gray-500">{t('Critério')}</label>
            <select
              value={criterionId}
              onChange={(e) => setCriterionId(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {quals.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="text-xs text-gray-500 ml-1">{t('Gravidade')}</label>
            <NumberCell value={severity} width="w-16" onChange={setSeverity} />
            {sevBand && <span className="text-[10px] text-gray-400 uppercase tracking-wider">{sevBand.label}</span>}
            <label className="text-xs text-gray-500 ml-1">{t('Ocorrência')}</label>
            <NumberCell value={occurrence} width="w-14" onChange={setOccurrence} />
            {results.length > 0 && (
              <>
                <label className="text-xs text-gray-500 ml-1">{t('Cenário')}</label>
                <select
                  value={chosen?.scenarioId ?? ''}
                  onChange={(e) => setScenarioId(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white max-w-[12rem]"
                >
                  {results.map((r) => <option key={r.scenarioId} value={r.scenarioId}>{r.label}</option>)}
                </select>
              </>
            )}
          </div>

          {!line ? (
            <p className="text-sm text-gray-400 py-6 text-center">{t('Escolha um critério para ver o cálculo.')}</p>
          ) : (
            <ol className="divide-y divide-gray-100">
              {line.steps.map((s, i) => (
                <li key={i} className={`grid grid-cols-[1.5rem_1fr_7rem] gap-3 items-center py-2.5 ${s.applied ? '' : 'opacity-55'}`}>
                  <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-500 grid place-items-center font-mono text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 leading-snug">
                    <strong className="font-medium">{s.label}.</strong> {s.detail}
                    {s.formula && <code className="block text-[11px] font-mono text-gray-400 mt-0.5">{s.formula}</code>}
                  </span>
                  <span className="text-right font-mono text-sm font-semibold text-gray-700">
                    {s.amount != null ? money(s.amount, rules.currency) : ''}
                  </span>
                </li>
              ))}
              <li className="grid grid-cols-[1.5rem_1fr_7rem] gap-3 items-center pt-3 border-t-2 border-gray-200">
                <span className="w-6 h-6 rounded-md bg-accent text-white grid place-items-center font-mono text-xs font-bold">=</span>
                <span className="text-sm font-medium text-gray-800">{t('Penalização deste incidente')}</span>
                <span className="text-right font-mono text-base font-bold text-accent-strong">
                  {money(line.amount, rules.currency)}
                </span>
              </li>
            </ol>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t('O que entrou no cálculo')}</p>
            <dl className="text-xs space-y-1">
              <Row label={t('Gravidade G')} value={String(severity)} />
              <Row label={t('Índice do cenário')} value={chosen?.globalValue != null ? chosen.globalValue.toFixed(1) : '—'} />
              <Row label={t('Zona')} value={band?.label ?? t('nenhuma')} />
              <Row label={t('Multiplicador')} value={`×${penalty.zone?.multiplier ?? 1}`} />
              <Row label={t('Versão das regras')} value={rules.version} />
            </dl>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
            {t('O valor MACBETH do critério não aparece nesta escada. A gravidade é lida do incidente; o índice entra apenas como multiplicador de zona.')}
          </div>

          {penalty.notes.map((n, i) => (
            <p key={i} className="text-xs text-gray-500 leading-relaxed">{n}</p>
          ))}

          {penalty.lines.length > 1 && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t('Total do cenário')}</p>
              {penalty.lines.map((l) => (
                <div key={l.incidentId} className="flex justify-between text-xs">
                  <span className="text-gray-600 truncate pr-2">{l.label}</span>
                  <span className="font-mono text-gray-700">{money(l.amount, rules.currency)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-gray-200">
                <span>{t('Total')}</span>
                <span className="font-mono text-accent-strong">{money(penalty.total, rules.currency)}</span>
              </div>
              {penalty.capApplied && (
                <p className="text-[11px] text-amber-700">{t('Tecto do período aplicado.')}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-mono text-gray-700">{value}</dd>
    </div>
  );
}
