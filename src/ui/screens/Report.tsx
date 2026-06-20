import { useApp } from '../store';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MacbethJudgment, OptionResult, DecisionBand } from '../../domain/types';
import { sortBands, bandRangeLabel, displayBands } from '../../domain/decision';
import { subjectNoun } from '../../domain/subject';
import { resolveBands } from '../../engine/aggregation';
import { effectiveWeights } from '../../domain/tree';
import { buildModelSpec, downloadJson } from '../../domain/modelSpec';

const DECISION_SCHEMA = 'choices/decision@1';

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

  const subj = subjectNoun(model);
  const qualCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  const effW = effectiveWeights(model);
  const bandMap = new Map((result?.decisionScale ?? model.decisionScale).map((b) => [b.id, b] as const));

  /** Reference alternative of a band rendered in human terms (for the audit trail). */
  function refProfileText(b: DecisionBand): string {
    if (!b.referenceProfile) return '';
    return Object.entries(b.referenceProfile)
      .map(([cid, lid]) => {
        const c = model.valueTree.criteria[cid];
        const lvl = c?.type === 'qualification' ? c.descriptor.levels.find((l) => l.id === lid) : undefined;
        return lvl ? `${c?.label}: ${lvl.label}` : null;
      })
      .filter(Boolean)
      .join('; ');
  }

  function decisionLabel(r: OptionResult): string {
    if (r.hardRejected) return 'Reprovado';
    return r.bandId ? bandMap.get(r.bandId)?.label ?? '—' : '—';
  }
  function decisionBand(r: OptionResult): DecisionBand | undefined {
    return r.bandId ? bandMap.get(r.bandId) : undefined;
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!result) return;
    const qualCrit = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
    const sorted = [...result.optionResults].sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity));
    const headers = ['#', subj.One, 'V(p)', 'Decisão', ...qualCrit.map((c) => c.label)];
    const rows = sorted.map((r, i) => {
      const opt = evaluation.options.find((o) => o.id === r.optionId);
      const band = r.bandId ? bandMap.get(r.bandId) : undefined;
      const decision = r.hardRejected ? 'Reprovado' : (band?.label ?? '—');
      const score = r.globalValue !== null ? r.globalValue.toFixed(1) : '—';
      const critScores = qualCrit.map((c) => {
        const s = r.criterionScores[c.id];
        return s !== null && s !== undefined ? s.toFixed(1) : '—';
      });
      return [String(i + 1), opt?.label ?? r.optionId, score, decision, ...critScores];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `choices-resultados-${evaluation.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── JSON Decision export (choices/decision@1) ──────────────────────────────
  function exportDecisionJSON() {
    const sorted = result
      ? [...result.optionResults].sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity))
      : [];
    const record = {
      schema: DECISION_SCHEMA,
      generatedAt: new Date().toISOString(),
      evaluation: { id: evaluation.id, label: evaluation.label, createdAt: evaluation.createdAt },
      model: { id: model.id, label: model.label, version: model.modelVersion },
      decisionBands: sortBands(result?.decisionScale ?? model.decisionScale).map((b) => {
        // Render the reference profile (if any) in human terms, so the threshold
        // is auditable: which boundary alternative justifies this cut-off.
        const referenceProfile = b.referenceProfile
          ? Object.entries(b.referenceProfile).map(([criterionId, levelId]) => {
              const crit = model.valueTree.criteria[criterionId];
              const level =
                crit?.type === 'qualification'
                  ? crit.descriptor.levels.find((l) => l.id === levelId)
                  : undefined;
              return { criterionId, criterion: crit?.label ?? criterionId, levelId, level: level?.label ?? levelId };
            })
          : null;
        return {
          id: b.id,
          label: b.label,
          action: b.action ?? null,
          color: b.color,
          minScore: b.minScore,
          thresholdSource: b.referenceProfile ? 'profile' : 'manual',
          referenceProfile,
        };
      }),
      results: sorted.map((r) => {
        const opt = evaluation.options.find((o) => o.id === r.optionId);
        const band = r.bandId ? bandMap.get(r.bandId) : undefined;
        return {
          optionId: r.optionId,
          label: opt?.label ?? r.optionId,
          globalValue: r.globalValue,
          bandId: r.bandId ?? null,
          bandLabel: band?.label ?? null,
          hardRejected: r.hardRejected ?? false,
          rejectedByGate: r.rejectedByGate ?? null,
          criterionScores: r.criterionScores,
          notes: evaluation.optionNotes?.[r.optionId] ?? null,
        };
      }),
      modelSpec: buildModelSpec(model),
    };
    downloadJson(`choices-decisao-${evaluation.id.slice(0, 8)}.json`, record);
  }

  // ── JSON Model Spec export (choices/model-spec@1) ──────────────────────────
  function exportSpecJSON() {
    const spec = buildModelSpec(model);
    downloadJson(`choices-modelo-${model.id.slice(0, 8)}.json`, spec);
  }

  // ── PDF export ─────────────────────────────────────────────────────────────
  async function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as Doc;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 16;

    function checkPage(needed = 25) {
      if (y + needed > pageH - 16) { doc.addPage(); y = 16; }
    }

    function sectionTitle(n: number, title: string) {
      checkPage(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`${n}. ${title}`, 14, y);
      y += 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Decisão', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(evaluation.label, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Gerado localmente em: ${new Date().toLocaleString('pt-PT')}`, pageW / 2, y, { align: 'center' });
    y += 10;

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
        head: [['#', subj.One, 'V(p)', 'Decisão', 'Observações']],
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

    sectionTitle(2, 'Metodologia');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const methodText = `Este relatório utiliza o Método MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique, Bana e Costa & Vansnick, 1994). O método utiliza juízos qualitativos de diferença de atratividade — de Nula a Extrema — entre pares de alternativas para construir escalas cardinais de valor por programação linear. O modelo de agregação é aditivo: V(p) = Σᵢ kᵢ · vᵢ(p), ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a ${subj.one} antes da agregação multicritério.`;
    const mLines = doc.splitTextToSize(methodText, pageW - 28);
    checkPage(mLines.length * 4.5 + 8);
    doc.text(mLines, 14, y);
    y += mLines.length * 4.5 + 6;

    sectionTitle(3, 'Escala de Decisão');
    const scale3 = result?.decisionScale ?? resolveBands(model);
    autoTable(doc, {
      startY: y,
      head: [['Zona / ação', 'Intervalo V(p)', 'Limiar', 'Fundamentação']],
      body: displayBands(scale3).map((v) => {
        const b = v.band;
        const zone = b.action ? `${b.label} — ${b.action}` : b.label;
        const src = v.isBase ? '—' : b.referenceProfile ? 'Fundamentado' : 'Manual';
        const just = v.isBase
          ? 'Zona base (aplica-se a tudo o que não atinge as zonas acima)'
          : b.referenceProfile
          ? `Alternativa-limiar — ${refProfileText(b)}`
          : 'Definido manualmente';
        return [zone, bandRangeLabel(b, scale3), src, just];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14, right: 14 },
      columnStyles: { 2: { fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable?.finalY ?? y;
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(
      doc.splitTextToSize(
        'Os limiares "Fundamentado" derivam de uma alternativa-limiar de referência (o pior caso ainda incluído na zona), cujo V(p) é calculado pelo modelo — rastreável e não arbitrário. "Manual" indica um valor inserido à mão.',
        pageW - 28,
      ),
      14,
      y,
    );
    doc.setTextColor(0);
    y += 10;

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
          const w = effW.get(c.id);
          return [
            c.label,
            c.descriptor.levels.map((l) => l.label).join(' › '),
            c.descriptor.levels[c.descriptor.neutralIndex]?.label ?? '',
            c.descriptor.levels[c.descriptor.goodIndex]?.label ?? '',
            w != null ? `${(w * 100).toFixed(1)}%` : '—',
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable?.finalY ?? y;
      y += 6;
    }

    sectionTitle(5, 'Trilho de Auditoria');
    for (const c of qualCrit) {
      if (c.type !== 'qualification') continue;
      const scale = model.derivedScales.find((s) => s.criterionId === c.id);
      const matrix = model.judgmentMatrices.find((m) => m.kind === 'scale' && m.criterionId === c.id);
      const w = effW.get(c.id);

      checkPage(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${c.label}${w != null ? ` — ${(w * 100).toFixed(1)}%` : ''}${scale ? ` — z = ${scale.consistencyMargin.toFixed(4)}` : ''}`, 14, y);
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

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Choices · MACBETH · ${evaluation.label} · Página ${i}/${pageCount} · Gerado localmente`, pageW / 2, pageH - 8, { align: 'center' });
      doc.setTextColor(0);
    }
    doc.save(`choices-relatorio-${evaluation.id.slice(0, 8)}.pdf`);
  }

  // ── HTML render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Relatório de Decisão</h2>
          <p className="text-sm text-gray-500 mt-0.5">{evaluation.label}</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Gerado localmente
        </span>
      </div>

      {/* Export buttons — 2×2 grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={exportPDF}
          className="flex flex-col items-center gap-1.5 px-3 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-semibold">PDF</span>
          <span className="text-[10px] opacity-80">Relatório completo</span>
        </button>

        <button
          onClick={exportCSV}
          disabled={!result}
          className="flex flex-col items-center gap-1.5 px-3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-semibold">CSV</span>
          <span className="text-[10px] opacity-80">Resultados tabulares</span>
        </button>

        <button
          onClick={exportDecisionJSON}
          className="flex flex-col items-center gap-1.5 px-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-semibold">JSON Decisão</span>
          <span className="text-[10px] opacity-80">choices/decision@1</span>
        </button>

        <button
          onClick={exportSpecJSON}
          className="flex flex-col items-center gap-1.5 px-3 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-semibold">Spec IA</span>
          <span className="text-[10px] opacity-80">choices/model-spec@1</span>
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
          O modelo de agregação é aditivo: <strong>V(p) = Σᵢ kᵢ · vᵢ(p)</strong>, ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a {subj.one} antes da agregação. O valor global é classificado pela escala de decisão configurada.
        </p>
      </section>

      {/* 3. Trilho de Auditoria */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h3 className="font-semibold text-gray-800">Trilho de Auditoria</h3>
        {qualCriteria.map((c) => {
          if (c.type !== 'qualification') return null;
          const scale = model.derivedScales.find((s) => s.criterionId === c.id);
          const matrix = model.judgmentMatrices.find((m) => m.kind === 'scale' && m.criterionId === c.id);
          const w = effW.get(c.id);
          return (
            <div key={c.id} className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">{c.label}</h4>
                <div className="flex gap-2 text-xs">
                  {scale && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">z = {scale.consistencyMargin.toFixed(4)}</span>}
                  {w != null && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">peso = {(w * 100).toFixed(1)}%</span>}
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
