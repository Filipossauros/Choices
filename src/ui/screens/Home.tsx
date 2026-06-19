import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { DocMeta } from '../../repository';

function PixelMascot() {
  return (
    <>
      <style>{`
        @keyframes choices-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes choices-scan {
          0%, 100% { opacity: 1; }
          48% { opacity: 1; }
          50% { opacity: 0.25; }
          52% { opacity: 1; }
        }
        .choices-mascot {
          animation: choices-bob 2.6s steps(2, end) infinite;
          display: inline-block;
        }
        .choices-mascot-eyes {
          animation: choices-scan 3.4s ease-in-out infinite;
        }
      `}</style>
      <svg
        className="choices-mascot"
        width="60"
        height="72"
        viewBox="0 0 16 18"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Antenna */}
        <rect x="7" y="0" width="2" height="2" fill="#f59e0b" />
        <rect x="7" y="2" width="2" height="1" fill="#64748b" />
        {/* Head shell */}
        <rect x="3" y="3" width="10" height="6" fill="#cbd5e1" />
        <rect x="3" y="3" width="10" height="1" fill="#e2e8f0" />
        <rect x="3" y="8" width="10" height="1" fill="#94a3b8" />
        <rect x="3" y="3" width="1" height="6" fill="#94a3b8" />
        <rect x="12" y="3" width="1" height="6" fill="#94a3b8" />
        {/* Side bolts */}
        <rect x="2" y="5" width="1" height="2" fill="#64748b" />
        <rect x="13" y="5" width="1" height="2" fill="#64748b" />
        {/* Visor */}
        <rect x="4" y="4" width="8" height="3" fill="#0f172a" />
        {/* Eyes (scanning lights) */}
        <g className="choices-mascot-eyes">
          <rect x="5" y="5" width="2" height="1" fill="#38bdf8" />
          <rect x="9" y="5" width="2" height="1" fill="#38bdf8" />
        </g>
        {/* Neck */}
        <rect x="6" y="9" width="4" height="1" fill="#64748b" />
        {/* Body */}
        <rect x="4" y="10" width="8" height="5" fill="#2563eb" />
        <rect x="4" y="10" width="8" height="1" fill="#3b82f6" />
        <rect x="4" y="14" width="8" height="1" fill="#1d4ed8" />
        {/* Chest panel + button */}
        <rect x="6" y="11" width="4" height="3" fill="#1e3a8a" />
        <rect x="7" y="12" width="2" height="1" fill="#38bdf8" />
        {/* Arms */}
        <rect x="2" y="10" width="2" height="4" fill="#94a3b8" />
        <rect x="12" y="10" width="2" height="4" fill="#94a3b8" />
        {/* Claws */}
        <rect x="2" y="14" width="2" height="1" fill="#f59e0b" />
        <rect x="12" y="14" width="2" height="1" fill="#f59e0b" />
        {/* Legs */}
        <rect x="5" y="15" width="2" height="2" fill="#64748b" />
        <rect x="9" y="15" width="2" height="2" fill="#64748b" />
        {/* Feet */}
        <rect x="4" y="17" width="3" height="1" fill="#0f172a" />
        <rect x="9" y="17" width="3" height="1" fill="#0f172a" />
      </svg>
    </>
  );
}

type View = 'menu' | 'create' | 'apply';

function DocList({
  docs,
  onOpen,
  onDelete,
  openLabel,
  empty,
}: {
  docs: DocMeta[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  openLabel: string;
  empty: string;
}) {
  if (docs.length === 0) {
    return <p className="text-sm text-gray-400 italic px-1">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {docs.map((m) => (
        <li key={m.id} className="flex items-center px-4 py-3 hover:bg-gray-50 gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 truncate">{m.label}</p>
            <p className="text-xs text-gray-400">{new Date(m.updatedAt).toLocaleString('pt-PT')}</p>
          </div>
          <button
            onClick={() => onOpen(m.id)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            {openLabel}
          </button>
          <button onClick={() => onDelete(m.id)} className="px-2 py-1 text-sm text-red-500 hover:text-red-700">
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const { dispatch } = useApp();
  const [view, setView] = useState<View>('menu');
  const [models, setModels] = useState<DocMeta[]>([]);
  const [evaluations, setEvaluations] = useState<DocMeta[]>([]);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(() => {
    repository.listModels().then(setModels).catch(() => {});
    repository.listEvaluations().then(setEvaluations).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Create flow ──────────────────────────────────────────────────────────
  function newModel() {
    dispatch({ type: 'NEW_MODEL' });
  }
  async function editModel(id: string) {
    const model = await repository.loadModel(id);
    if (model) dispatch({ type: 'EDIT_MODEL', model });
  }
  async function deleteModel(id: string) {
    if (!confirm('Eliminar este modelo?')) return;
    await repository.deleteModel(id);
    refresh();
  }

  // ── Apply flow ───────────────────────────────────────────────────────────
  async function applyModel(id: string) {
    const model = await repository.loadModel(id);
    if (model) dispatch({ type: 'START_EVALUATION', model });
  }
  async function resumeEvaluation(id: string) {
    const evaluation = await repository.loadEvaluation(id);
    if (evaluation) dispatch({ type: 'OPEN_EVALUATION', evaluation });
  }
  async function deleteEvaluation(id: string) {
    if (!confirm('Eliminar esta análise?')) return;
    await repository.deleteEvaluation(id);
    refresh();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>, target: View) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const doc = repository.parseDocument(await file.text());
      if (doc.kind === 'evaluation') {
        if (target === 'create') {
          await repository.saveModel(doc.model);
          dispatch({ type: 'EDIT_MODEL', model: doc.model });
        } else {
          await repository.saveEvaluation(doc);
          dispatch({ type: 'OPEN_EVALUATION', evaluation: doc });
        }
      } else {
        await repository.saveModel(doc);
        if (target === 'create') dispatch({ type: 'EDIT_MODEL', model: doc });
        else dispatch({ type: 'START_EVALUATION', model: doc });
      }
    } catch (err) {
      alert('Erro ao importar: ' + String(err));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-3">
          <PixelMascot />
        </div>
        <h1 className="text-3xl font-bold text-blue-800">Choices</h1>
        <p className="text-gray-500">Avaliação Multicritério de Alternativas</p>
        <p className="text-gray-400 italic text-sm">o que vais decidir hoje?</p>
      </div>

      {view === 'menu' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => setView('create')}
            className="p-6 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-colors text-left space-y-1"
          >
            <div className="text-2xl">🛠️</div>
            <p className="font-semibold text-blue-800">Criar modelo de avaliação</p>
            <p className="text-sm text-blue-700/70">
              Definir critérios, escalas de valor, pesos e a escala de decisão.
            </p>
          </button>
          <button
            onClick={() => setView('apply')}
            className="p-6 rounded-2xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-colors text-left space-y-1"
          >
            <div className="text-2xl">📋</div>
            <p className="font-semibold text-green-800">Aplicar modelo para avaliar</p>
            <p className="text-sm text-green-700/70">
              Registar propostas, habilitá-las e obter resultados com um modelo.
            </p>
          </button>
        </div>
      )}

      {view === 'create' && (
        <div className="space-y-5">
          <button onClick={() => setView('menu')} className="text-sm text-gray-400 hover:text-gray-700">
            ← Voltar
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={newModel}
              className="col-span-2 py-4 bg-blue-700 text-white text-lg font-semibold rounded-xl hover:bg-blue-800 transition-colors"
            >
              + Novo modelo de avaliação
            </button>
            <label className={`col-span-2 py-3 text-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-sm font-medium text-gray-600">{importing ? 'A importar…' : '↑ Importar modelo (JSON)'}</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'create')} />
            </label>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Modelos guardados</h2>
            <DocList docs={models} onOpen={editModel} onDelete={deleteModel} openLabel="Editar" empty="Ainda sem modelos guardados." />
          </div>
        </div>
      )}

      {view === 'apply' && (
        <div className="space-y-6">
          <button onClick={() => setView('menu')} className="text-sm text-gray-400 hover:text-gray-700">
            ← Voltar
          </button>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Escolher um modelo para avaliar</h2>
            <DocList docs={models} onOpen={applyModel} onDelete={async (id) => { if (confirm('Eliminar este modelo?')) { await repository.deleteModel(id); refresh(); } }} openLabel="Aplicar" empty="Sem modelos. Crie um primeiro." />
            <label className={`block py-3 text-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-sm font-medium text-gray-600">{importing ? 'A importar…' : '↑ Importar modelo (JSON) e aplicar'}</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'apply')} />
            </label>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Retomar análise em curso</h2>
            <DocList docs={evaluations} onOpen={resumeEvaluation} onDelete={deleteEvaluation} openLabel="Abrir" empty="Sem análises em curso." />
            <label className={`block py-3 text-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-sm font-medium text-gray-600">{importing ? 'A importar…' : '↑ Importar análise (JSON)'}</span>
              <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'apply')} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
