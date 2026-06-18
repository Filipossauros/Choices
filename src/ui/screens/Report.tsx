import { useApp } from '../store';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const VERDICT_LABELS: Record<string, string> = {
  approved: 'Aprovado',
  conditional: 'Aprovado com condições',
  rejected: 'Reprovado',
};

export default function Report() {
  const { state } = useApp();
  const model = state.model!;

  const result = model.aggregationResult;
  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );

  async function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 16;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Decisão MACBETH', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(model.label, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, pageW / 2, y, { align: 'center' });
    y += 10;

    // Methodology
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Metodologia', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const methodText = `MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique) é um método de apoio à decisão multicritério baseado em juízos qualitativos de diferença de atratividade (categorias C0–C6). O método deriva escalas cardinais de valor por programação linear e agrega-as num modelo aditivo V(p) = Σᵢ kᵢ · vᵢ(p) ancorado em Neutro = 0 e Bom = 100.`;
    const lines = doc.splitTextToSize(methodText, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 6;

    // Criteria
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Critérios', 14, y);
    y += 5;

    const gateCrit = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');
    const qualCrit = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');

    if (gateCrit.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Porta (habilitação)', 'Descrição']],
        body: gateCrit.map((c) => [c.label, c.description ?? '']),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }

    if (qualCrit.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Critério MACBETH', 'Níveis (melhor → pior)', 'Neutro', 'Bom', 'Peso']],
        body: qualCrit.map((c) => {
          if (c.type !== 'qualification') return [];
          const w = model.weights?.weights.find((w) => w.criterionId === c.id);
          return [
            c.label,
            c.descriptor.levels.map((l) => l.label).join(' › '),
            c.descriptor.levels[c.descriptor.neutralIndex]?.label ?? '',
            c.descriptor.levels[c.descriptor.goodIndex]?.label ?? '',
            w ? `${(w.weight * 100).toFixed(1)}%` : '—',
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }

    // Results
    if (result) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('3. Resultados', 14, y);
      y += 5;

      const sorted = [...result.optionResults].sort(
        (a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity),
      );

      autoTable(doc, {
        startY: y,
        head: [['#', 'Proposta', 'V(p)', 'Decisão', 'Observações']],
        body: sorted.map((r, i) => {
          const opt = model.options.find((o) => o.id === r.optionId);
          const obs = r.rejectedByGate
            ? `Porta: ${model.valueTree.criteria[r.rejectedByGate]?.label}`
            : r.vetoedByCriterion
            ? `Veto: ${model.valueTree.criteria[r.vetoedByCriterion]?.label}`
            : '';
          return [
            String(i + 1),
            opt?.label ?? r.optionId,
            r.globalValue !== null ? r.globalValue.toFixed(1) : '—',
            VERDICT_LABELS[r.verdict] ?? r.verdict,
            obs,
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 },
        bodyStyles: { textColor: [30, 30, 30] },
        columnStyles: { 2: { halign: 'right' }, 3: { fontStyle: 'bold' } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      // Criteria scores profile
      if (qualCrit.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Perfil por Critério', 14, y);
        y += 4;

        const optionLabels = sorted.map(
          (r) => model.options.find((o) => o.id === r.optionId)?.label ?? r.optionId,
        );

        autoTable(doc, {
          startY: y,
          head: [['Critério', ...optionLabels]],
          body: qualCrit.map((c) =>
            [
              c.label,
              ...sorted.map((r) => {
                const s = r.criterionScores[c.id];
                return s !== null && s !== undefined ? s.toFixed(1) : '—';
              }),
            ],
          ),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `MACBETH — Relatório de Decisão · ${model.label} · Página ${i}/${pageCount}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
      );
      doc.setTextColor(0);
    }

    doc.save(`macbeth-relatorio-${model.id.slice(0, 8)}.pdf`);
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Relatório de Decisão</h2>
        <button
          onClick={exportPDF}
          className="px-5 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium"
        >
          ↓ Exportar PDF
        </button>
      </div>

      {/* Methodology */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-2">
        <h3 className="font-semibold text-gray-800">Metodologia MACBETH</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique) é um método de apoio à decisão multicritério que utiliza juízos qualitativos de diferença de atratividade (categorias C0–C6) entre alternativas para construir escalas cardinais de valor por programação linear.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          O modelo de agregação é aditivo: <strong>V(p) = Σᵢ kᵢ · vᵢ(p)</strong>, numa escala ancorada em Neutro = 0 e Bom = 100. A habilitação (Andar 1) corre a montante — qualquer porta falhada reprova antes da agregação.
        </p>
      </section>

      {/* Audit trail */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h3 className="font-semibold text-gray-800">Trilho de Auditoria</h3>

        {qualCriteria.map((c) => {
          if (c.type !== 'qualification') return null;
          const scale = model.derivedScales.find((s) => s.criterionId === c.id);
          const matrix = model.judgmentMatrices.find(
            (m) => m.kind === 'scale' && m.criterionId === c.id,
          );
          const w = model.weights?.weights.find((w) => w.criterionId === c.id);

          return (
            <div key={c.id} className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">{c.label}</h4>
                <div className="flex gap-2 text-xs">
                  {scale && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      z = {scale.consistencyMargin.toFixed(4)}
                    </span>
                  )}
                  {w && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      peso = {(w.weight * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {scale && (
                <div className="text-xs text-gray-600 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {scale.values.map((sv) => {
                    const level = c.descriptor.levels.find((l) => l.id === sv.levelId);
                    return (
                      <span key={sv.levelId}>
                        <strong>{level?.label}</strong>: {sv.value.toFixed(1)}{' '}
                        <span className="text-gray-400">
                          [{sv.admissibleRange[0].toFixed(1)}, {sv.admissibleRange[1].toFixed(1)}]
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}

              {matrix && Object.keys(matrix.judgments).length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">
                    Ver juízos ({Object.keys(matrix.judgments).length} entradas)
                  </summary>
                  <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {Object.entries(matrix.judgments).map(([key, j]) => {
                      const [idA, idB] = key.split('__');
                      const lA = c.descriptor.levels.find((l) => l.id === idA)?.label ?? idA;
                      const lB = c.descriptor.levels.find((l) => l.id === idB)?.label ?? idB;
                      const cat = j.kind === 'exact' ? `C${j.category}` : `C${j.lo}–C${j.hi}`;
                      return (
                        <span key={key}>
                          {lA} vs {lB}: <strong>{cat}</strong>
                        </span>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>

      {/* Results summary */}
      {result && (
        <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
          <h3 className="font-semibold text-gray-800">Recomendação</h3>
          <p className="text-xs text-gray-500">
            Limiar de aprovação ≥ {result.approvedThreshold} · Limiar condicional ≥ {result.conditionalThreshold}
          </p>
          {[...result.optionResults]
            .sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity))
            .map((r) => {
              const opt = model.options.find((o) => o.id === r.optionId);
              return (
                <div
                  key={r.optionId}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    r.verdict === 'approved'
                      ? 'border-green-200 bg-green-50'
                      : r.verdict === 'conditional'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <span className="font-medium text-gray-800 flex-1">{opt?.label}</span>
                  <span className="font-mono font-bold text-gray-700">
                    {r.globalValue !== null ? r.globalValue.toFixed(1) : '—'}
                  </span>
                  <span className={`text-sm font-semibold ${
                    r.verdict === 'approved' ? 'text-green-700' :
                    r.verdict === 'conditional' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {VERDICT_LABELS[r.verdict]}
                  </span>
                </div>
              );
            })}
        </section>
      )}
    </div>
  );
}
