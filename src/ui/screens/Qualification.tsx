import { useApp } from '../store';

export default function Qualification() {
  const { state } = useApp();
  const model = state.model!;

  const gates = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'gate',
  );

  if (gates.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Nenhuma porta (gate) definida. Adicione critérios do tipo «Porta» na Estruturação.</p>
      </div>
    );
  }

  if (model.options.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Nenhuma proposta registada. Adicione propostas no ecrã «Propostas».</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
        <strong>Andar 1 — Habilitação.</strong> Uma falha em qualquer porta reprova a proposta
        a montante, antes da avaliação multicritério. Defina os valores na coluna «Desempenho» das propostas.
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200">Proposta</th>
              {gates.map((g) => (
                <th key={g.id} className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200">
                  {g.label}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {model.options.map((option) => {
              const gateStatuses = gates.map((g) => {
                const val = model.performances.find(
                  (p) => p.optionId === option.id && p.criterionId === g.id,
                )?.value ?? 'pending';
                return { gate: g, val };
              });
              const allPass = gateStatuses.every((s) => s.val === 'pass');
              const anyFail = gateStatuses.some((s) => s.val === 'fail');

              return (
                <tr key={option.id} className={anyFail ? 'bg-red-50' : allPass ? 'bg-green-50' : ''}>
                  <td className="px-3 py-2 border border-gray-200 font-medium">{option.label}</td>
                  {gateStatuses.map(({ gate, val }) => (
                    <td key={gate.id} className="border border-gray-200 text-center px-3 py-2">
                      {val === 'pass' ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          ✓ Cumpre
                        </span>
                      ) : val === 'fail' ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          ✗ Não cumpre
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Por verificar</span>
                      )}
                    </td>
                  ))}
                  <td className="border border-gray-200 text-center px-3 py-2">
                    {anyFail ? (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-semibold">
                        Reprovado
                      </span>
                    ) : allPass ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-semibold">
                        Habilitado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                        Por verificar
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
