import { useApp } from '../store';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MacbethJudgment, OptionResult, DecisionBand } from '../../domain/types';
import { sortBands, bandRangeLabel } from '../../domain/decision';

const JUDGMENT_WORDS = ['Nula', 'Muito fraca', 'Fraca', 'Moderada', 'Forte', 'Muito forte', 'Extrema'];
function judgmentLabel(j: MacbethJudgment): string {
  if (j.kind === 'exact') return JUDGMENT_WORDS[j.category] ?? `C${j.category}`;
  return `${JUDGMENT_WORDS[j.lo] ?? `C${j.lo}`}–${JUDGMENT_WORDS[j.hi] ?? `C${j.hi}`}`;
}

export default function Report() {
  const { state } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;
  const result = evaluation.aggregationResult;

  const qualCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  const bandMap = new Map((result?.decisionScale ?? model.decisionScale).map((b) => [b.id, b] as const));
  function decisionLabel(r: OptionResult): string {
    if (r.hardRejected) return 'Reprovado';
    return r.bandId ? bandMap.get(r.bandId)?.label ?? '—' : '—';
  }
  function decisionBand(r: OptionResult): DecisionBand | undefined {
    return r.bandId ? bandMap.get(r.bandId) : undefined;
  }

  async function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Decisão', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(evaluation.label, pageW / 2, y, { align: 'center' });
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
    const methodText = `Método de apoio à decisão multicritério que utiliza juízos qualitativos de diferença de atratividade (Nula a Extrema) entre pares de alternativas para construir escalas cardinais de valor (curvas suaves, monótonas). O modelo de agregação é aditivo: V(p) = Σᵢ kᵢ · vᵢ(p), ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova antes da agregação. O valor global é classificado por uma escala de decisão de bandas nomeadas.`;
    const lines = doc.splitTextToSize(methodText, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 6;

    // Decision scale
    const scaleBands = sortBands(result?.decisionScale ?? model.decisionScale);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Escala de decisão', 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Ponto de decisão', 'Intervalo de V(p)']],
      body: scaleBands.map((b) => [b.label, bandRangeLabel(b, scaleBands)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Criteria
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('3. Critérios', 14, y);
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
        head: [['Critério', 'Níveis (melhor → pior)', 'Neutro', 'Bom', 'Peso']],
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
      doc.text('4. Resultados', 14, y);
      y += 5;
      const sorted = [...result.optionResults].sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity));
      autoTable(doc, {
        startY: y,
        head: [['#', 'Proposta', 'V(p)', 'Decisão', 'Observações']],
        body: sorted.map((r, i) => {
          const opt = evaluation.options.find((o) => o.id === r.optionId);
          const obs = r.rejectedByGate
            ? `Porta: ${model.valueTree.criteria[r.rejectedByGate]?.label}`
            : r.vetoedByCriterion
            ? `Veto: ${model.valueTree.criteria[r.vetoedByCriterion]?.label}`
            : '';
          return [String(i + 1), opt?.label ?? r.optionId, r.globalValue !== null ? r.globalValue.toFixed(1) : '—', decisionLabel(r), obs];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 },
        bodyStyles: { textColor: [30, 30, 30] },
        columnStyles: { 2: { halign: 'right' }, 3: { fontStyle: 'bold' } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      if (qualCrit.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Perfil por Critério', 14, y);
        y += 4;
        const optionLabels = sorted.map((r) => evaluation.options.find((o) => o.id === r.optionId)?.label ?? r.optionId);
        autoTable(doc, {
          startY: y,
          head: [['Critério', ...optionLabels]],
          body: qualCrit.map((c) => [
            c.label,
            ...sorted.map((r) => {
              const s = r.criterionScores[c.id];
              return s !== null && s !== undefined ? s.toFixed(1) : '—';
            }),
          ]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 14, right: 14 },
        });
      }
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Choices — Relatório de Decisão · ${evaluation.label} · Página ${i}/${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      doc.setTextColor(0);
    }
    doc.save(`choices-relatorio-${evaluation.id.slice(0, 8)}.pdf`);
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Relatório de Decisão</h2>
        <button onClick={exportPDF} className="px-5 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">
          ↓ Exportar PDF
        </button>
      </div>

      {/* Methodology */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-2">
        <h3 className="font-semibold text-gray-800">Metodologia</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Método de apoio à decisão multicritério que utiliza juízos qualitativos de diferença de atratividade — de <em>Nula</em> a <em>Extrema</em> — entre pares de alternativas para construir escalas cardinais de valor (curvas suaves, monótonas).
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          O modelo de agregação é aditivo: <strong>V(p) = Σᵢ kᵢ · vᵢ(p)</strong>, ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a proposta antes da agregação. O valor global é classificado pela escala de decisão.
        </p>
      </section>

      {/* Audit trail */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h3 className="font-semibold text-gray-800">Trilho de Auditoria</h3>
        {qualCriteria.map((c) => {
          if (c.type !== 'qualification') return null;
          const scale = model.derivedScales.find((s) => s.criterionId === c.id);
          const matrix = model.judgmentMatrices.find((m) => m.kind === 'scale' && m.criterionId === c.id);
          const w = model.weights?.weights.find((w) => w.criterionId === c.id);
          return (
            <div key={c.id} className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">{c.label}</h4>
                <div className="flex gap-2 text-xs">
                  {scale && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">z = {scale.consistencyMargin.toFixed(4)}</span>}
                  {w && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">peso = {(w.weight * 100).toFixed(1)}%</span>}
                </div>
              </div>
              {scale && (
                <div className="text-xs text-gray-600 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {scale.values.map((sv) => {
                    const level = c.descriptor.levels.find((l) => l.id === sv.levelId);
                    return (
                      <span key={sv.levelId}>
                        <strong>{level?.label}</strong>: {sv.value.toFixed(1)}{' '}
                        <span className="text-gray-400">[{sv.admissibleRange[0].toFixed(1)}, {sv.admissibleRange[1].toFixed(1)}]</span>
                      </span>
                    );
                  })}
                </div>
              )}
              {matrix && Object.keys(matrix.judgments).length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">Ver juízos ({Object.keys(matrix.judgments).length} entradas)</summary>
                  <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {Object.entries(matrix.judgments).map(([key, j]) => {
                      const [idA, idB] = key.split('__');
                      const lA = c.descriptor.levels.find((l) => l.id === idA)?.label ?? idA;
                      const lB = c.descriptor.levels.find((l) => l.id === idB)?.label ?? idB;
                      return (
                        <span key={key}>{lA} vs {lB}: <strong>{judgmentLabel(j)}</strong></span>
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
          <div className="flex flex-wrap gap-2 text-xs">
            {sortBands(result.decisionScale).map((b) => (
              <span key={b.id} className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: b.color }}>
                {b.label}: {bandRangeLabel(b, result.decisionScale)}
              </span>
            ))}
          </div>
          {[...result.optionResults]
            .sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity))
            .map((r) => {
              const opt = evaluation.options.find((o) => o.id === r.optionId);
              const band = decisionBand(r);
              const bg = r.hardRejected ? '#fee2e2' : band ? band.color + '22' : '#f3f4f6';
              const fg = r.hardRejected ? '#b91c1c' : band?.color ?? '#6b7280';
              return (
                <div key={r.optionId} className="flex items-center gap-3 p-3 rounded-lg border" style={{ backgroundColor: bg, borderColor: fg + '55' }}>
                  <span className="font-medium text-gray-800 flex-1">{opt?.label}</span>
                  <span className="font-mono font-bold text-gray-700">{r.globalValue !== null ? r.globalValue.toFixed(1) : '—'}</span>
                  <span className="text-sm font-semibold" style={{ color: fg }}>{decisionLabel(r)}</span>
                </div>
              );
            })}
        </section>
      )}
    </div>
  );
}
