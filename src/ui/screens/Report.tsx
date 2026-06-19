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

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

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
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as Doc;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 16;

    function checkPage(needed = 25) {
      if (y + needed > pageH - 16) {
        doc.addPage();
        y = 16;
      }
    }

    function sectionTitle(n: number, title: string) {
      checkPage(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`${n}. ${title}`, 14, y);
      y += 6;
    }

    // ── Header ──────────────────────────────────────────────────────────────
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

    // ── 1. Decisão ──────────────────────────────────────────────────────────
    sectionTitle(1, 'Decisão');
    if (result) {
      const scaleBands = sortBands(result.decisionScale);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Escala de decisão aplicada:', 14, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      scaleBands.forEach((b) => {
        doc.text(`• ${b.label}: ${bandRangeLabel(b, result.decisionScale)}`, 18, y);
        y += 4;
      });
      y += 2;

      const sorted = [...result.optionResults].sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity));
      const optionNotes = evaluation.optionNotes ?? {};
      autoTable(doc, {
        startY: y,
        head: [['#', 'Proposta', 'V(p)', 'Decisão', 'Observações']],
        body: sorted.map((r, i) => {
          const opt = evaluation.options.find((o) => o.id === r.optionId);
          const gateNote = r.rejectedByGate ? `Porta: ${model.valueTree.criteria[r.rejectedByGate]?.label}` : '';
          const vetoNote = r.vetoedByCriterion ? `Veto: ${model.valueTree.criteria[r.vetoedByCriterion]?.label}` : '';
          const userNote = optionNotes[r.optionId] ?? '';
          const obs = [gateNote, vetoNote, userNote].filter(Boolean).join(' | ');
          return [String(i + 1), opt?.label ?? r.optionId, r.globalValue !== null ? r.globalValue.toFixed(1) : '—', decisionLabel(r), obs];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 },
        bodyStyles: { textColor: [30, 30, 30] },
        columnStyles: { 2: { halign: 'right' }, 3: { fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable?.finalY ?? y;
      y += 6;

      if (qualCriteria.length > 0) {
        checkPage(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Perfil por Critério', 14, y);
        y += 4;
        const optLabels = sorted.map((r) => evaluation.options.find((o) => o.id === r.optionId)?.label ?? r.optionId);
        autoTable(doc, {
          startY: y,
          head: [['Critério', ...optLabels]],
          body: qualCriteria.map((c) => {
            if (c.type !== 'qualification') return [];
            return [c.label, ...sorted.map((r) => {
              const s = r.criterionScores[c.id];
              return s !== null && s !== undefined ? s.toFixed(1) : '—';
            })];
          }),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable?.finalY ?? y;
        y += 6;
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('(Nenhum resultado calculado)', 14, y);
      y += 8;
    }

    // ── 2. Metodologia ─────────────────────────────────────────────────────
    sectionTitle(2, 'Metodologia');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const methodText = `Este relatório utiliza o Método MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique, Bana e Costa & Vansnick, 1994). O método utiliza juízos qualitativos de diferença de atratividade — de Nula a Extrema — entre pares de alternativas para construir escalas cardinais de valor por programação linear. O modelo de agregação é aditivo: V(p) = Σᵢ kᵢ · vᵢ(p), ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a proposta antes da agregação multicritério.`;
    const mLines = doc.splitTextToSize(methodText, pageW - 28);
    checkPage(mLines.length * 4.5 + 8);
    doc.text(mLines, 14, y);
    y += mLines.length * 4.5 + 6;

    // ── 3. Escala de Decisão ───────────────────────────────────────────────
    sectionTitle(3, 'Escala de Decisão');
    const scaleBands = sortBands(result?.decisionScale ?? model.decisionScale);
    autoTable(doc, {
      startY: y,
      head: [['Ponto de decisão', 'Intervalo de V(p)']],
      body: scaleBands.map((b) => [b.label, bandRangeLabel(b, result?.decisionScale ?? model.decisionScale)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable?.finalY ?? y;
    y += 6;

    // ── 4. Critérios ───────────────────────────────────────────────────────
    sectionTitle(4, 'Critérios');
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
      y = doc.lastAutoTable?.finalY ?? y;
      y += 4;
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
      y = doc.lastAutoTable?.finalY ?? y;
      y += 6;
    }

    // ── 5. Trilho de Auditoria ─────────────────────────────────────────────
    sectionTitle(5, 'Trilho de Auditoria');
    for (const c of qualCrit) {
      if (c.type !== 'qualification') continue;
      const scale = model.derivedScales.find((s) => s.criterionId === c.id);
      const matrix = model.judgmentMatrices.find((m) => m.kind === 'scale' && m.criterionId === c.id);
      const w = model.weights?.weights.find((w) => w.criterionId === c.id);

      checkPage(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${c.label}${w ? ` — ${(w.weight * 100).toFixed(1)}%` : ''}${scale ? ` — z = ${scale.consistencyMargin.toFixed(4)}` : ''}`, 14, y);
      y += 4;

      if (scale) {
        autoTable(doc, {
          startY: y,
          head: [['Nível', 'Valor', 'Intervalo admissível']],
          body: [...scale.values]
            .sort((a, b) => b.value - a.value)
            .map((sv) => {
              const lv = c.descriptor.levels.find((l) => l.id === sv.levelId);
              return [lv?.label ?? sv.levelId, sv.value.toFixed(1), `[${sv.admissibleRange[0].toFixed(1)}, ${sv.admissibleRange[1].toFixed(1)}]`];
            }),
          styles: { fontSize: 7.5 },
          headStyles: { fillColor: [100, 116, 139] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable?.finalY ?? y;
        y += 3;
      }

      if (matrix && Object.keys(matrix.judgments).length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Par', 'Juízo']],
          body: Object.entries(matrix.judgments).map(([key, j]) => {
            const [idA, idB] = key.split('__');
            const lA = c.descriptor.levels.find((l) => l.id === idA)?.label ?? idA;
            const lB = c.descriptor.levels.find((l) => l.id === idB)?.label ?? idB;
            return [`${lA} vs ${lB}`, judgmentLabel(j)];
          }),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [148, 163, 184] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable?.finalY ?? y;
        y += 4;
      }
    }

    // ── Page footer ─────────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Choices · MACBETH · ${evaluation.label} · Página ${i}/${pageCount}`, pageW / 2, pageH - 8, { align: 'center' });
      doc.setTextColor(0);
    }
    doc.save(`choices-relatorio-${evaluation.id.slice(0, 8)}.pdf`);
  }

  // ── HTML render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Relatório de Decisão</h2>
        <button onClick={exportPDF} className="px-5 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">
          ↓ Exportar PDF
        </button>
      </div>

      {/* 1. Decisão */}
      {result && (
        <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
          <h3 className="font-semibold text-gray-800">Decisão</h3>
          <div className="flex flex-wrap gap-2 text-xs mb-1">
            {sortBands(result.decisionScale).map((b) => (
              <span key={b.id} className="px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: b.color }}>
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
              const note = evaluation.optionNotes?.[r.optionId];
              return (
                <div key={r.optionId} className="flex items-start gap-3 p-3 rounded-lg border" style={{ backgroundColor: bg, borderColor: fg + '55' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{opt?.label}</p>
                    {note && <p className="text-xs text-gray-500 mt-0.5 italic">{note}</p>}
                  </div>
                  <span className="font-mono font-bold text-gray-700 shrink-0">{r.globalValue !== null ? r.globalValue.toFixed(1) : '—'}</span>
                  <span className="text-sm font-semibold shrink-0" style={{ color: fg }}>{decisionLabel(r)}</span>
                </div>
              );
            })}
        </section>
      )}

      {/* 2. Metodologia */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-2">
        <h3 className="font-semibold text-gray-800">Metodologia — Método MACBETH</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          <em>Measuring Attractiveness by a Categorical Based Evaluation Technique</em> (Bana e Costa &amp; Vansnick, 1994). Utiliza juízos qualitativos de diferença de atratividade — de <em>Nula</em> a <em>Extrema</em> — entre pares de alternativas para construir escalas cardinais de valor por programação linear.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          O modelo de agregação é aditivo: <strong>V(p) = Σᵢ kᵢ · vᵢ(p)</strong>, ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a proposta antes da agregação. O valor global é classificado pela escala de decisão configurada.
        </p>
      </section>

      {/* 3. Trilho de Auditoria */}
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
                  {[...scale.values].sort((a, b) => b.value - a.value).map((sv) => {
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
                      return <span key={key}>{lA} vs {lB}: <strong>{judgmentLabel(j)}</strong></span>;
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
