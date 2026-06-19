import { useState, useEffect } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';

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
        <h1 className="text-3xl font-bold text-blue-800">Escolhas</h1>
        <p className="text-gray-500">Avaliação Multicritério de Alternativas</p>
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

      <div className="text-xs text-gray-400 text-center space-y-1">
        <p>Local-first — os dados ficam no seu dispositivo (IndexedDB).</p>
        <p>Baseado no método MACBETH © Bana e Costa & Vansnick</p>
      </div>
    </div>
  );
}
