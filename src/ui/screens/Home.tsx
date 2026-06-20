import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { DocMeta } from '../../repository';
import MethodPage from './MethodPage';
import ManifestPage from './ManifestPage';

function TealRobotMascot() {
  return (
    <>
      <style>{`
        @keyframes rm-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes rm-blink {
          0%, 88%, 100% { transform: scaleY(1); }
          93% { transform: scaleY(0.08); }
        }
        .rm-body { animation: rm-float 3.2s ease-in-out infinite; display: inline-block; }
        .rm-eyes { animation: rm-blink 5s ease-in-out infinite; transform-origin: 50% 50%; }
      `}</style>
      <svg
        className="rm-body"
        width="120"
        height="140"
        viewBox="0 0 120 140"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Antennae ── */}
        <line x1="43" y1="18" x2="38" y2="5" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="77" y1="18" x2="82" y2="5" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="38" cy="4" r="4.5" fill="#f59e0b" />
        <circle cx="82" cy="4" r="4.5" fill="#f59e0b" />

        {/* ── Head ── */}
        <rect x="20" y="14" width="80" height="58" rx="26" fill="#14b8a6" />
        {/* head top sheen */}
        <ellipse cx="60" cy="22" rx="28" ry="8" fill="#2dd4bf" opacity="0.45" />

        {/* ── Headphone ears (large circles flush against head sides) ── */}
        {/* Left outer ring */}
        <circle cx="20" cy="44" r="16" fill="#0d9488" />
        {/* Left inner ring */}
        <circle cx="20" cy="44" r="9" fill="#14b8a6" />
        {/* Left speaker dot */}
        <circle cx="20" cy="44" r="4" fill="#0f766e" />
        {/* Right outer ring */}
        <circle cx="100" cy="44" r="16" fill="#0d9488" />
        {/* Right inner ring */}
        <circle cx="100" cy="44" r="9" fill="#14b8a6" />
        {/* Right speaker dot */}
        <circle cx="100" cy="44" r="4" fill="#0f766e" />

        {/* ── Eyes ── */}
        <g className="rm-eyes">
          {/* Left eye white */}
          <ellipse cx="43" cy="41" rx="11" ry="12" fill="white" />
          {/* Right eye white */}
          <ellipse cx="77" cy="41" rx="11" ry="12" fill="white" />
          {/* Left iris */}
          <circle cx="44" cy="42" r="7" fill="#0f172a" />
          {/* Right iris */}
          <circle cx="78" cy="42" r="7" fill="#0f172a" />
          {/* Left highlight */}
          <circle cx="47" cy="39" r="3" fill="white" />
          {/* Right highlight */}
          <circle cx="81" cy="39" r="3" fill="white" />
        </g>

        {/* ── Smile ── */}
        <path d="M42 62 Q60 74 78 62" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Cheeks */}
        <ellipse cx="32" cy="60" rx="8" ry="5" fill="#f9a8d4" opacity="0.35" />
        <ellipse cx="88" cy="60" rx="8" ry="5" fill="#f9a8d4" opacity="0.35" />

        {/* ── Neck ── */}
        <rect x="48" y="72" width="24" height="10" rx="5" fill="#0d9488" />

        {/* ── Body (compact, sitting) ── */}
        <rect x="22" y="81" width="76" height="44" rx="24" fill="#14b8a6" />
        <ellipse cx="60" cy="88" rx="28" ry="9" fill="#2dd4bf" opacity="0.35" />

        {/* ── Laptop ── */}
        {/* Screen lid */}
        <rect x="20" y="100" width="80" height="46" rx="7" fill="#1e293b" />
        <rect x="23" y="103" width="74" height="38" rx="5" fill="#1e3a8a" />
        {/* Screen glow lines */}
        <rect x="29" y="108" width="36" height="3" rx="1.5" fill="#38bdf8" opacity="0.75" />
        <rect x="29" y="114" width="52" height="3" rx="1.5" fill="#34d399" opacity="0.6" />
        <rect x="29" y="120" width="28" height="3" rx="1.5" fill="#f59e0b" opacity="0.6" />
        <rect x="29" y="126" width="44" height="3" rx="1.5" fill="#38bdf8" opacity="0.45" />
        {/* Keyboard base / hinge */}
        <rect x="18" y="145" width="84" height="8" rx="4" fill="#0f766e" />
        {/* Keyboard keys hint */}
        <rect x="26" y="147" width="68" height="4" rx="2" fill="#0d9488" />
        {/* Legs/feet peeking at corners */}
        <ellipse cx="32" cy="143" rx="13" ry="7" fill="#0d9488" />
        <ellipse cx="88" cy="143" rx="13" ry="7" fill="#0d9488" />
      </svg>
    </>
  );
}

type View = 'menu' | 'create' | 'apply' | 'method' | 'manifest';

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

  if (view === 'method') return <MethodPage onBack={() => setView('menu')} />;
  if (view === 'manifest') return <ManifestPage onBack={() => setView('menu')} />;

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

      {view === 'menu' && (
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <button onClick={() => setView('method')} className="text-gray-400 hover:text-gray-700 transition-colors">
            📘 Como funciona o método MACBETH
          </button>
          <span className="text-gray-200">·</span>
          <button onClick={() => setView('manifest')} className="text-gray-400 hover:text-gray-700 transition-colors">
            🧩 Manifesto de capacidades (para IA)
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
