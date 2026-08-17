/**
 * Recovery surface for an evaluation whose embedded model snapshot cannot
 * produce results.
 *
 * An Evaluation carries a deep copy of the model it was started from, so
 * finishing the library model afterwards does not reach evaluations already in
 * flight. Without a way back, every performance already entered would have to
 * be re-entered in a fresh evaluation — so this offers to pull the newer
 * version of the same model into the evaluation, keeping the answers that still
 * resolve against it.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { repository } from '../../repository';
import { modelReadiness } from '../../domain/tree';
import type { EvaluationModel } from '../../domain/types';

export default function ModelNotReady({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const evaluation = state.evaluation!;
  const snapshot = evaluation.model;

  const [library, setLibrary] = useState<EvaluationModel | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    repository
      .loadModel(snapshot.id)
      .then((m) => { if (live) setLibrary(m ?? null); })
      .catch(() => { if (live) setLibrary(null); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [snapshot.id, snapshot.updatedAt]);

  const snap = modelReadiness(snapshot);
  const lib = library ? modelReadiness(library) : null;
  const canRefresh = !!library && !!lib?.ready;

  const missing = [
    !snap.hasCriteria ? t('critérios de qualificação') : null,
    snap.hasCriteria && !snap.scalesReady
      ? t('escalas consistentes ({{list}})', { list: snap.pendingScales.join(', ') })
      : null,
    !snap.weightsReady ? t('ponderação de todos os grupos') : null,
  ].filter(Boolean).join(' · ');

  function refresh() {
    if (!library) return;
    dispatch({ type: 'REFRESH_EVALUATION_MODEL', model: library });
  }

  function editModel() {
    if (library) dispatch({ type: 'EDIT_MODEL', model: library });
    else dispatch({ type: 'EDIT_MODEL', model: snapshot });
  }

  const actions = (
    <div className="flex flex-wrap gap-2 pt-1">
      {canRefresh && (
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
          title={t('Traz a versão concluída do modelo para esta avaliação, mantendo os desempenhos já registados.')}
        >
          {t('Atualizar modelo desta avaliação')}
        </button>
      )}
      <button
        onClick={editModel}
        className="px-3 py-1.5 text-sm font-medium border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100/60"
      >
        {t('Completar o modelo')}
      </button>
    </div>
  );

  const status = !loaded
    ? null
    : canRefresh
    ? t('Já existe uma versão concluída deste modelo na biblioteca — pode trazê-la para aqui sem perder os desempenhos já registados.')
    : library
    ? t('A versão na biblioteca também ainda não está completa. Termine-a e volte aqui para a trazer.')
    : t('O modelo de origem já não está na biblioteca. Abra-o para o completar e guardar.');

  if (compact) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 space-y-2">
        <p>
          <strong>{t('Este modelo ainda não produz resultados.')}</strong>{' '}
          {t('Falta: {{missing}}. Pode registar desempenhos agora, mas os Resultados só ficam disponíveis depois de o modelo estar completo.', { missing })}
        </p>
        {status && <p className="text-xs text-amber-800/80">{status}</p>}
        {actions}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-amber-900">
          {t('Ainda não é possível calcular resultados')}
        </h2>
        <p className="text-sm text-amber-900">
          {t('A avaliação usa uma cópia do modelo tal como estava quando começou. Nessa cópia falta: {{missing}}.', { missing })}
        </p>
        {status && <p className="text-sm text-amber-800/80">{status}</p>}
        {actions}
      </div>
    </div>
  );
}
