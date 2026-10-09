import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { weightClaims, weightShowdown, type Claim, type WeightedLeaf } from '../../engine/explain';
import { weightingGroups, weightsForGroup, setGroupWeights } from '../../domain/tree';

/**
 * "Faz sentido?" — the step between answering and trusting.
 *
 * Weighting used to end in percentages and an admissible range, and then ask the
 * respondent to confirm them. Neither is something a non-specialist can check:
 * nobody knows whether 58% is their opinion. So end the step with the two things
 * they *can* check — sentences about their own priorities, and a concrete
 * head-to-head with the model's verdict on it. A weight that is wrong rarely
 * looks wrong in a bar; it looks wrong when the wrong proposal wins.
 *
 * Disagreeing is a first-class answer: it names the comparisons responsible and
 * opens them. Nothing here changes the model on its own.
 */

function ClaimText({ claim }: { claim: Claim }) {
  const { t } = useTranslation();
  switch (claim.kind) {
    case 'dominates':
      return (
        <>
          {claim.groupLabel && <>{t('Dentro de «{{g}}»:', { g: claim.groupLabel })} </>}
          <strong>{claim.winner}</strong>{' '}
          {claim.others.length > 1
            ? t('pesa mais do que {{others}} em conjunto', { others: claim.others.join(t(' e ')) })
            : t('pesa mais do que {{others}}', { others: claim.others[0] })}
          {' — '}
          {t('{{a}} pontos em cada 100, contra {{b}}.', { a: claim.winnerPct, b: claim.othersPct })}
        </>
      );
    case 'ratio':
      return (
        <>
          {claim.groupLabel && <>{t('Dentro de «{{g}}»:', { g: claim.groupLabel })} </>}
          <strong>{claim.a}</strong> {t('vale cerca de')} <strong>{t('{{n}}×', { n: claim.times })}</strong>{' '}
          <strong>{claim.b}</strong>.
        </>
      );
    case 'negligible':
      return (
        <>
          <strong>{claim.label}</strong>{' '}
          {t('quase não conta: {{p}} pontos em cada 100. Uma proposta pode ser fraca aí sem grande consequência.', { p: claim.pct })}
        </>
      );
    case 'ceiling':
      return (
        <>
          {t('Uma proposta boa em tudo menos em')} <strong>{claim.label}</strong>{' '}
          {t('fica em {{s}} pontos.', { s: claim.score })}
        </>
      );
  }
}

/** One side of the head-to-head: which criteria are at «Bom», which at neutral. */
function TestProposal({
  name, rows, goodIds, score, winner,
}: {
  name: string;
  /** Every criterion, in the same order on both cards, so the eye can compare. */
  rows: WeightedLeaf[];
  goodIds: Set<string>;
  score: number;
  winner: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border-[1.5px] overflow-hidden ${winner ? 'border-green-400 bg-green-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{name}</span>
        {winner && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('ganha')}</span>}
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((l) => {
          const isGood = goodIds.has(l.criterionId);
          return (
            <li key={l.criterionId} className="px-3 py-1.5 flex gap-2 items-baseline">
              <span className={`text-[10px] font-bold shrink-0 ${isGood ? 'text-green-600' : 'text-gray-300'}`} aria-hidden="true">
                {isGood ? '▲' : '–'}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-gray-400 truncate">{l.label}</span>
                <span className={`block text-[13px] ${isGood ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                  {isGood ? l.goodLabel : l.neutralLabel}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{t('pontuação')}</span>
        <span className={`font-mono font-bold text-base ${winner ? 'text-green-700' : 'text-gray-600'}`}>{score.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function SanityCheck({ onRevisit }: { onRevisit: (groupId: string) => void }) {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [agreed, setAgreed] = useState(false);
  const [disagreed, setDisagreed] = useState(false);

  const claims = weightClaims(model);
  const showdown = weightShowdown(model);
  if (claims.length === 0 || !showdown) return null;

  /**
   * The respondent stands by these weights, however they were produced.
   *
   * Accumulated into one patch rather than dispatched per group: every
   * sub-group's patch rebuilds the whole `subWeights` map from the model it was
   * given, so three dispatches off the same snapshot keep only the last one.
   */
  function agree() {
    let next = model;
    let changed = false;
    for (const group of weightingGroups(model)) {
      const w = weightsForGroup(next, group.parentId);
      if (!w || w.confirmed) continue;
      next = { ...next, ...setGroupWeights(next, group.parentId, { ...w, confirmed: true }) };
      changed = true;
    }
    if (changed) {
      dispatch({ type: 'UPDATE_MODEL', patch: { weights: next.weights, subWeights: next.subWeights } });
    }
    setDisagreed(false);
    setAgreed(true);
  }

  // Which comparisons to reopen when the verdict is rejected: the groups the
  // claims came from, heaviest first — those are the answers doing the work.
  const rows = [showdown.solo, ...showdown.rest];

  const suspects = [...new Set(claims.flatMap((c) => (c.kind === 'dominates' || c.kind === 'ratio' ? [c.groupId] : [])))];
  const groupName = (id: string) =>
    model.valueTree.criteria[id]?.label ?? t('Fatores de topo');

  if (agreed) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-green-600" aria-hidden="true">✓</span>
        <p className="text-sm text-green-900 flex-1">{t('Confirmou que a importância está como pensa.')}</p>
        <button onClick={() => setAgreed(false)} className="text-xs font-semibold text-green-800 underline underline-offset-2">
          {t('rever outra vez')}
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800 tracking-tight">{t('Faz sentido?')}</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {t('Isto é o que as suas respostas dizem, por palavras. Se alguma frase lhe soar errada, é porque uma das respostas não era o que queria — e dá para voltar atrás sem perder o resto.')}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <ol className="space-y-0">
          {claims.map((claim, i) => (
            <li key={i} className="flex gap-3 items-start py-2.5 border-b border-gray-100 last:border-0">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 grid place-items-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">
                <ClaimText claim={claim} />
              </p>
            </li>
          ))}
        </ol>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {t('Teste rápido')} <span className="font-normal normal-case tracking-normal">· {t('duas propostas inventadas a partir dos seus pesos')}</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <TestProposal
              name={t('Proposta A')}
              rows={rows}
              goodIds={new Set([showdown.solo.criterionId])}
              score={showdown.soloScore}
              winner={showdown.winner === 'solo'}
            />
            <TestProposal
              name={t('Proposta B')}
              rows={rows}
              goodIds={new Set(showdown.rest.map((l) => l.criterionId))}
              score={showdown.restScore}
              winner={showdown.winner === 'rest'}
            />
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {showdown.winner === 'tie'
              ? t('Com as suas respostas, as duas empatam: ser bom só em «{{solo}}» vale tanto como ser bom em tudo o resto.', { solo: showdown.solo.label })
              : showdown.winner === 'solo'
              ? t('Com as suas respostas ganha a A: ser bom só em «{{solo}}» vale mais do que ser bom em todos os outros critérios juntos.', { solo: showdown.solo.label })
              : t('Com as suas respostas ganha a B: ser bom em todos os outros critérios vale mais do que ser bom só em «{{solo}}».', { solo: showdown.solo.label })}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={agree}
              className="flex-1 min-w-[10rem] px-4 py-2.5 rounded-xl border-[1.5px] border-green-400 bg-green-50 text-green-800 text-sm font-semibold hover:bg-green-100"
            >
              {t('Sim, é isso mesmo')}
            </button>
            <button
              onClick={() => setDisagreed(true)}
              className="flex-1 min-w-[10rem] px-4 py-2.5 rounded-xl border-[1.5px] border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
            >
              {t('Não — não é o que penso')}
            </button>
          </div>

          {disagreed && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3.5 space-y-2">
              <p className="text-[13px] text-amber-900 leading-relaxed">
                {t('Então uma destas comparações não era o que queria dizer. Nada é apagado — abra a que lhe parecer errada e mude a resposta.')}
              </p>
              <div className="flex flex-wrap gap-2">
                {suspects.map((id) => (
                  <button
                    key={id}
                    onClick={() => { setDisagreed(false); onRevisit(id); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                  >
                    {t('Rever «{{g}}»', { g: groupName(id) })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
