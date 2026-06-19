import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';

function PixelMascot() {
  return (
    <>
      <style>{`
        @keyframes escolhas-bob {
          0%, 100% { transform: translateY(0px); }
          40% { transform: translateY(-6px); }
          60% { transform: translateY(-4px); }
        }
        @keyframes escolhas-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        .escolhas-mascot {
          animation: escolhas-bob 3s ease-in-out infinite;
          display: inline-block;
        }
        .escolhas-mascot-eye {
          animation: escolhas-blink 4s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
      <svg
        className="escolhas-mascot"
        width="56"
        height="72"
        viewBox="0 0 14 18"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Antenna */}
        <rect x="6" y="0" width="2" height="1" fill="#94a3b8" />
        <rect x="5" y="1" width="4" height="1" fill="#f59e0b" />
        {/* Head */}
        <rect x="2" y="2" width="10" height="7" fill="#fcd34d" />
        {/* Head shading sides */}
        <rect x="2" y="2" width="1" height="7" fill="#f59e0b" />
        <rect x="11" y="2" width="1" height="7" fill="#f59e0b" />
        {/* Eyes */}
        <g className="escolhas-mascot-eye">
          <rect x="4" y="4" width="2" height="2" fill="#1e293b" />
          <rect x="8" y="4" width="2" height="2" fill="#1e293b" />
          {/* Eye shine */}
          <rect x="4" y="4" width="1" height="1" fill="#bfdbfe" />
          <rect x="8" y="4" width="1" height="1" fill="#bfdbfe" />
        </g>
        {/* Smile */}
        <rect x="5" y="7" width="4" height="1" fill="#92400e" />
        <rect x="4" y="6" width="1" height="1" fill="#92400e" />
        <rect x="9" y="6" width="1" height="1" fill="#92400e" />
        {/* Neck */}
        <rect x="6" y="9" width="2" height="1" fill="#d97706" />
        {/* Body */}
        <rect x="3" y="10" width="8" height="5" fill="#3b82f6" />
        <rect x="3" y="10" width="1" height="5" fill="#2563eb" />
        <rect x="10" y="10" width="1" height="5" fill="#2563eb" />
        {/* Chest panel */}
        <rect x="5" y="11" width="4" height="3" fill="#bfdbfe" />
        <rect x="6" y="12" width="2" height="1" fill="#3b82f6" />
        {/* Arms */}
        <rect x="1" y="10" width="2" height="4" fill="#3b82f6" />
        <rect x="11" y="10" width="2" height="4" fill="#3b82f6" />
        {/* Hands */}
        <rect x="1" y="14" width="2" height="2" fill="#fcd34d" />
        <rect x="11" y="14" width="2" height="2" fill="#fcd34d" />
        {/* Legs */}
        <rect x="4" y="15" width="2" height="3" fill="#1d4ed8" />
        <rect x="8" y="15" width="2" height="3" fill="#1d4ed8" />
        {/* Feet */}
        <rect x="3" y="17" width="3" height="1" fill="#1e293b" />
        <rect x="8" y="17" width="3" height="1" fill="#1e293b" />
      </svg>
    </>
  );
}

export default function Home() {
  const { dispatch } = useApp();
  const [saved, setSaved] = useState<{ id: string; label: string; updatedAt: string }[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    repository.listModels().then(setSaved).catch(() => {});
  }, []);

  function handleNew() {
    dispatch({ type: 'NEW_MODEL' });
  }

  async function handleLoad(id: string) {
    const model = await repository.loadModel(id);
    if (model) {
      dispatch({ type: 'SET_MODEL', model });
      dispatch({ type: 'SET_SCREEN', screen: 'structuring' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este modelo?')) return;
    await repository.deleteModel(id);
    setSaved((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const model = await repository.importModel(text);
      dispatch({ type: 'SET_MODEL', model });
      dispatch({ type: 'SET_SCREEN', screen: 'structuring' });
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
        <h1 className="text-3xl font-bold text-blue-800">Escolhas</h1>
        <p className="text-gray-500">Avaliação Multicritério de Alternativas</p>
        <p className="text-gray-400 italic text-sm">o que vais decidir hoje?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleNew}
          className="col-span-2 py-4 bg-blue-700 text-white text-lg font-semibold rounded-xl hover:bg-blue-800 transition-colors"
        >
          + Novo Modelo de Avaliação
        </button>

        <label className={`py-3 text-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
          <span className="text-sm font-medium text-gray-600">
            {importing ? 'A importar…' : '↑ Importar JSON'}
          </span>
          <input type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Modelos guardados</h2>
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
            {saved.map((m) => (
              <li key={m.id} className="flex items-center px-4 py-3 hover:bg-gray-50 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{m.label}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(m.updatedAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <button
                  onClick={() => handleLoad(m.id)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Abrir
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="px-2 py-1 text-sm text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
