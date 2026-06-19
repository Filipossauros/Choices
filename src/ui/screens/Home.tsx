import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { DocMeta } from '../../repository';

function TealRobotMascot() {
  return (
    <>
      <style>{`
        @keyframes robot-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes robot-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        .robot-float { animation: robot-float 3s ease-in-out infinite; display: inline-block; }
        .robot-eyes { animation: robot-blink 4s ease-in-out infinite; transform-origin: center; }
      `}</style>
      <svg
        className="robot-float"
        width="110"
        height="130"
        viewBox="0 0 110 130"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Antennae ── */}
        <line x1="38" y1="20" x2="34" y2="6" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="72" y1="20" x2="76" y2="6" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="33" cy="5" r="4" fill="#f59e0b" />
        <circle cx="77" cy="5" r="4" fill="#f59e0b" />

        {/* ── Head ── */}
        <rect x="22" y="16" width="66" height="52" rx="20" fill="#14b8a6" />
        {/* Head highlight */}
        <rect x="28" y="19" width="54" height="12" rx="10" fill="#2dd4bf" opacity="0.5" />

        {/* ── Headphone ears ── */}
        {/* Left */}
        <circle cx="22" cy="42" r="13" fill="#0d9488" />
        <circle cx="22" cy="42" r="7" fill="#14b8a6" />
        <circle cx="22" cy="42" r="3.5" fill="#0d9488" />
        {/* Right */}
        <circle cx="88" cy="42" r="13" fill="#0d9488" />
        <circle cx="88" cy="42" r="7" fill="#14b8a6" />
        <circle cx="88" cy="42" r="3.5" fill="#0d9488" />

        {/* ── Eyes ── */}
        <g className="robot-eyes">
          <ellipse cx="41" cy="38" rx="10" ry="11" fill="white" />
          <ellipse cx="69" cy="38" rx="10" ry="11" fill="white" />
          <circle cx="42" cy="39" r="6" fill="#0f172a" />
          <circle cx="70" cy="39" r="6" fill="#0f172a" />
          {/* Iris highlight */}
          <circle cx="44" cy="37" r="2.5" fill="white" />
          <circle cx="72" cy="37" r="2.5" fill="white" />
          {/* Pupil dot */}
          <circle cx="42" cy="39" r="2" fill="#1e3a8a" />
          <circle cx="70" cy="39" r="2" fill="#1e3a8a" />
        </g>

        {/* ── Smile ── */}
        <path d="M39 56 Q55 68 71 56" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Rosy cheeks */}
        <circle cx="30" cy="55" r="6" fill="#f472b6" opacity="0.3" />
        <circle cx="80" cy="55" r="6" fill="#f472b6" opacity="0.3" />

        {/* ── Neck ── */}
        <rect x="46" y="68" width="18" height="9" rx="4" fill="#0d9488" />

        {/* ── Body ── */}
        <rect x="18" y="76" width="74" height="48" rx="22" fill="#14b8a6" />
        {/* Body highlight */}
        <rect x="24" y="79" width="62" height="14" rx="10" fill="#2dd4bf" opacity="0.4" />

        {/* ── Laptop ── */}
        {/* Screen */}
        <rect x="24" y="100" width="62" height="30" rx="6" fill="#1e293b" />
        <rect x="27" y="103" width="56" height="24" rx="4" fill="#1e3a8a" />
        {/* Screen content (code lines) */}
        <rect x="31" y="107" width="30" height="2.5" rx="1" fill="#38bdf8" opacity="0.7" />
        <rect x="31" y="112" width="42" height="2.5" rx="1" fill="#34d399" opacity="0.6" />
        <rect x="31" y="117" width="22" height="2.5" rx="1" fill="#f59e0b" opacity="0.6" />
        {/* Keyboard base */}
        <rect x="20" y="128" width="70" height="7" rx="4" fill="#0f172a" opacity="0.6" />

        {/* ── Crossed legs suggestion (feet peeking below laptop) ── */}
        <ellipse cx="33" cy="126" rx="12" ry="6" fill="#0d9488" />
        <ellipse cx="77" cy="126" rx="12" ry="6" fill="#0d9488" />
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
          <TealRobotMascot />
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
