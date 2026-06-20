import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { DocMeta } from '../../repository';
import type { EvaluationModel } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';
import MethodPage from './MethodPage';
import ManifestPage from './ManifestPage';
import { v4 as uuidv4 } from 'uuid';

// ── Mascot ────────────────────────────────────────────────────────────────────

function TealRobotMascot() {
  return (
    <>
      <style>{`
        @keyframes rm-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes rm-blink { 0%,88%,100%{transform:scaleY(1)} 93%{transform:scaleY(0.08)} }
        .rm-body{animation:rm-float 3.2s ease-in-out infinite;display:inline-block}
        .rm-eyes{animation:rm-blink 5s ease-in-out infinite;transform-origin:50% 50%}
      `}</style>
      <svg className="rm-body" width="80" height="96" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
        <line x1="43" y1="18" x2="38" y2="5" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="77" y1="18" x2="82" y2="5" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="38" cy="4" r="4.5" fill="#f59e0b" />
        <circle cx="82" cy="4" r="4.5" fill="#f59e0b" />
        <rect x="20" y="14" width="80" height="58" rx="26" fill="#14b8a6" />
        <ellipse cx="60" cy="22" rx="28" ry="8" fill="#2dd4bf" opacity="0.45" />
        <circle cx="20" cy="44" r="16" fill="#0d9488" />
        <circle cx="20" cy="44" r="9" fill="#14b8a6" />
        <circle cx="100" cy="44" r="16" fill="#0d9488" />
        <circle cx="100" cy="44" r="9" fill="#14b8a6" />
        <g className="rm-eyes">
          <ellipse cx="43" cy="41" rx="11" ry="12" fill="white" />
          <ellipse cx="77" cy="41" rx="11" ry="12" fill="white" />
          <circle cx="44" cy="42" r="7" fill="#0f172a" />
          <circle cx="78" cy="42" r="7" fill="#0f172a" />
          <circle cx="47" cy="39" r="3" fill="white" />
          <circle cx="81" cy="39" r="3" fill="white" />
        </g>
        <path d="M42 62 Q60 74 78 62" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </>
  );
}

// ── Template factories ─────────────────────────────────────────────────────────

function makeLevel(label: string, desc?: string) {
  return { id: uuidv4(), label, description: desc };
}

function makeTemplateArchitecture(): EvaluationModel {
  const now = new Date().toISOString();

  const autLevels = [makeLevel('Forte (MFA + SSO)'), makeLevel('Básica (password)'), makeLevel('Sem autenticação')];
  const cifLevels = [makeLevel('AES-256 / TLS 1.3'), makeLevel('AES-128 / TLS 1.2'), makeLevel('Sem cifra')];
  const intLevels = [makeLevel('APIs abertas REST/GraphQL'), makeLevel('APIs proprietárias'), makeLevel('Sem integração')];
  const matLevels = [makeLevel('Maduro (TRL 8–9)'), makeLevel('Em maturação (TRL 5–7)'), makeLevel('Experimental (TRL 1–4)')];
  const supLevels = [makeLevel('Comunidade activa e grande'), makeLevel('Suporte moderado'), makeLevel('Suporte limitado')];

  const segId = uuidv4();
  const autId = uuidv4();
  const cifId = uuidv4();
  const rgpdId = uuidv4();
  const intId = uuidv4();
  const tecId = uuidv4();
  const matId = uuidv4();
  const supId = uuidv4();

  return {
    kind: 'model',
    id: uuidv4(),
    modelVersion: MODEL_VERSION,
    label: 'Avaliação de arquiteturas de SI',
    description: 'Avaliação de propostas de arquitetura por fatores estruturados (Segurança, Interoperabilidade, Tecnologia).',
    createdAt: now,
    updatedAt: now,
    valueTree: {
      root: {
        criterionId: 'root',
        children: [
          {
            criterionId: segId,
            children: [
              { criterionId: autId, children: [] },
              { criterionId: cifId, children: [] },
              { criterionId: rgpdId, children: [] },
            ],
          },
          { criterionId: intId, children: [] },
          {
            criterionId: tecId,
            children: [
              { criterionId: matId, children: [] },
              { criterionId: supId, children: [] },
            ],
          },
        ],
      },
      criteria: {
        [segId]: { id: segId, type: 'composite', label: 'Segurança', description: 'Proteção, cifra e conformidade regulatória.' },
        [autId]: { id: autId, type: 'qualification', label: 'Autenticação', parentId: segId, descriptor: { levels: autLevels, neutralIndex: 1, goodIndex: 0 } },
        [cifId]: { id: cifId, type: 'qualification', label: 'Cifra de dados', parentId: segId, descriptor: { levels: cifLevels, neutralIndex: 1, goodIndex: 0 } },
        [rgpdId]: { id: rgpdId, type: 'gate', label: 'Conformidade RGPD', description: 'Deve cumprir o RGPD/GDPR — critério eliminatório.' },
        [intId]: { id: intId, type: 'qualification', label: 'Interoperabilidade', descriptor: { levels: intLevels, neutralIndex: 1, goodIndex: 0 } },
        [tecId]: { id: tecId, type: 'composite', label: 'Tecnologia', description: 'Maturidade e ecossistema da stack tecnológica.' },
        [matId]: { id: matId, type: 'qualification', label: 'Maturidade', parentId: tecId, descriptor: { levels: matLevels, neutralIndex: 1, goodIndex: 0 } },
        [supId]: { id: supId, type: 'qualification', label: 'Suporte da comunidade', parentId: tecId, descriptor: { levels: supLevels, neutralIndex: 1, goodIndex: 0 } },
      },
    },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: [
      { id: uuidv4(), label: 'Aprovado', minScore: 70, color: '#16a34a' },
      { id: uuidv4(), label: 'Com reservas', minScore: 45, color: '#d97706' },
      { id: uuidv4(), label: 'Rejeitado', minScore: -999, color: '#dc2626' },
    ],
  };
}

function makeTemplateRisco(): EvaluationModel {
  const now = new Date().toISOString();

  const latLevels = [
    makeLevel('< 100 ms', 'Excelente — resposta quase imediata'),
    makeLevel('100–300 ms', 'Bom — utilizador não nota atraso'),
    makeLevel('300–1000 ms', 'Aceitável — atraso ligeiro'),
    makeLevel('> 1000 ms', 'Mau — atraso perceptível'),
  ];
  const errLevels = [
    makeLevel('< 0,1%', 'Excelente — erros praticamente nulos'),
    makeLevel('0,1–1%', 'Aceitável — erros raros'),
    makeLevel('1–5%', 'Preocupante — erros frequentes'),
    makeLevel('> 5%', 'Crítico — serviço degradado'),
  ];
  const satLevels = [
    makeLevel('< 50%', 'Confortável — capacidade disponível'),
    makeLevel('50–75%', 'Normal — uso saudável'),
    makeLevel('75–90%', 'Elevado — aproxima-se do limite'),
    makeLevel('> 90%', 'Crítico — sem folga'),
  ];
  const critLevels = [makeLevel('Crítico (produção)'), makeLevel('Importante (negócio)'), makeLevel('Secundário (interno)')];
  const durLevels = [makeLevel('< 30 min'), makeLevel('30 min – 4 h'), makeLevel('> 4 h')];
  const respLevels = [makeLevel('Fornecedor externo'), makeLevel('Partilhada'), makeLevel('Equipa própria')];

  const hsId = uuidv4();
  const latId = uuidv4();
  const errId = uuidv4();
  const satId = uuidv4();
  const critId = uuidv4();
  const durId = uuidv4();
  const respId = uuidv4();

  return {
    kind: 'model',
    id: uuidv4(),
    modelVersion: MODEL_VERSION,
    label: 'Risco / monitorização de plataforma',
    description: 'Compõe um índice de risco a partir de HealthStatus (métricas contínuas) e factores contextuais.',
    createdAt: now,
    updatedAt: now,
    valueTree: {
      root: {
        criterionId: 'root',
        children: [
          {
            criterionId: hsId,
            children: [
              { criterionId: latId, children: [] },
              { criterionId: errId, children: [] },
              { criterionId: satId, children: [] },
            ],
          },
          { criterionId: critId, children: [] },
          { criterionId: durId, children: [] },
          { criterionId: respId, children: [] },
        ],
      },
      criteria: {
        [hsId]: { id: hsId, type: 'composite', label: 'HealthStatus', description: 'Estado de saúde técnica da plataforma.' },
        [latId]: { id: latId, type: 'qualification', label: 'Latência', parentId: hsId, continuous: true, descriptor: { levels: latLevels, neutralIndex: 2, goodIndex: 0 } },
        [errId]: { id: errId, type: 'qualification', label: 'Taxa de erros', parentId: hsId, continuous: true, descriptor: { levels: errLevels, neutralIndex: 1, goodIndex: 0 } },
        [satId]: { id: satId, type: 'qualification', label: 'Saturação', parentId: hsId, continuous: true, descriptor: { levels: satLevels, neutralIndex: 1, goodIndex: 0 } },
        [critId]: { id: critId, type: 'qualification', label: 'Criticidade', descriptor: { levels: critLevels, neutralIndex: 1, goodIndex: 0 } },
        [durId]: { id: durId, type: 'qualification', label: 'Duração', descriptor: { levels: durLevels, neutralIndex: 1, goodIndex: 0 } },
        [respId]: { id: respId, type: 'qualification', label: 'Responsabilidade', descriptor: { levels: respLevels, neutralIndex: 1, goodIndex: 0 } },
      },
    },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: [
      { id: uuidv4(), label: 'Nenhuma ação', minScore: 75, color: '#16a34a' },
      { id: uuidv4(), label: 'Advertência', minScore: 40, color: '#d97706' },
      { id: uuidv4(), label: 'Sanção / coima', minScore: -999, color: '#dc2626' },
    ],
  };
}

const TEMPLATES = [
  { key: 'architecture', emoji: '🏛️', label: 'Avaliação de arquiteturas de SI', meta: '3 fatores · 5 critérios · 1 porta', factory: makeTemplateArchitecture },
  { key: 'platform', emoji: '📡', label: 'Risco / monitorização de plataforma', meta: 'HealthStatus + 3 métricas contínuas', factory: makeTemplateRisco },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ updatedAt }: { updatedAt: string }) {
  return (
    <span className="text-xs text-gray-400">
      {new Date(updatedAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

type View = 'menu' | 'method' | 'manifest';

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const { dispatch } = useApp();
  const [view, setView] = useState<View>('menu');
  const [models, setModels] = useState<DocMeta[]>([]);
  const [evaluations, setEvaluations] = useState<DocMeta[]>([]);
  const [importing, setImporting] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllEvals, setShowAllEvals] = useState(false);
  const [pickModel, setPickModel] = useState(false);

  const refresh = useCallback(() => {
    repository.listModels().then(setModels).catch(() => {});
    repository.listEvaluations().then(setEvaluations).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function newModel() { dispatch({ type: 'NEW_MODEL' }); }

  function fromTemplate(factory: () => EvaluationModel) {
    dispatch({ type: 'EDIT_MODEL', model: factory() });
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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>, target: 'create' | 'apply') {
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

  const recentModels = showAllModels ? models : models.slice(0, 3);
  const recentEvals = showAllEvals ? evaluations : evaluations.slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">

      {/* ── Welcome ── */}
      <div className="flex items-center gap-5 mb-10">
        <TealRobotMascot />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">O que vais decidir hoje?</h1>
          <p className="text-gray-500 text-sm mt-1">
            Avaliação multicritério de propostas ou posições
          </p>
        </div>
      </div>

      {/* ── Main action cards ── */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-5 flex flex-col">
          <div className="text-2xl mb-2">🛠️</div>
          <h2 className="font-bold text-indigo-900 text-base mb-1">Criar modelo de avaliação</h2>
          <p className="text-sm text-indigo-700/70 mb-4 flex-1">
            Definir critérios, escalas de valor, pesos e perfis de decisão.
          </p>
          <div>
            <button onClick={newModel} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              + Novo modelo
            </button>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-5 flex flex-col">
          <div className="text-2xl mb-2">📋</div>
          <h2 className="font-bold text-emerald-900 text-base mb-1">Avaliar propostas ou posições</h2>
          <p className="text-sm text-emerald-700/70 mb-4 flex-1">
            Aplicar um modelo a um conjunto concreto de alternativas e obter resultados.
          </p>
          <div className="space-y-2">
            {models.length === 0 ? (
              <span className="text-xs text-gray-400 italic">Cria um modelo primeiro.</span>
            ) : !pickModel ? (
              <button onClick={() => setPickModel(true)} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                + Nova avaliação
              </button>
            ) : (
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => { if (e.target.value) applyModel(e.target.value); }}
                className="w-full border border-emerald-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-400"
              >
                <option value="" disabled>Escolher modelo a avaliar…</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Library ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Models */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Modelos disponíveis</h3>
              <div className="flex items-center gap-3">
                {models.length > 3 && (
                  <button onClick={() => setShowAllModels(!showAllModels)} className="text-xs text-indigo-600 hover:underline">
                    {showAllModels ? 'Mostrar menos' : `Ver todos (${models.length})`}
                  </button>
                )}
                <label className={`text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {importing ? 'A importar…' : '↑ Importar JSON'}
                  <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'create')} />
                </label>
              </div>
            </div>
            {recentModels.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-400 italic">
                Ainda sem modelos. Cria um do zero, importa um JSON ou usa um modelo-base à direita.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentModels.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{m.label}</p>
                      <StatusPill updatedAt={m.updatedAt} />
                    </div>
                    <button onClick={() => editModel(m.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Editar</button>
                    <button onClick={() => applyModel(m.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Avaliar</button>
                    <button onClick={() => deleteModel(m.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Evaluations */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Avaliações recentes</h3>
              <div className="flex items-center gap-3">
                {evaluations.length > 2 && (
                  <button onClick={() => setShowAllEvals(!showAllEvals)} className="text-xs text-indigo-600 hover:underline">
                    {showAllEvals ? 'Mostrar menos' : `Ver todas (${evaluations.length})`}
                  </button>
                )}
                <label className={`text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {importing ? 'A importar…' : '↑ Importar JSON'}
                  <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'apply')} />
                </label>
              </div>
            </div>
            {recentEvals.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-400 italic">
                Sem avaliações em curso. Inicia uma nova avaliação acima ou importa um JSON de uma avaliação anterior.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentEvals.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{e.label}</p>
                      <StatusPill updatedAt={e.updatedAt} />
                    </div>
                    <button onClick={() => resumeEvaluation(e.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Abrir</button>
                    <button onClick={() => deleteEvaluation(e.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Sidebar: templates + links ── */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-1">Modelos-base</h3>
            <p className="text-xs text-gray-400 mb-3">Arranca de um exemplo completo e adapta.</p>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => fromTemplate(t.factory)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="font-medium text-gray-800 text-sm group-hover:text-indigo-700">
                    {t.emoji} {t.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.meta}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <button onClick={() => setView('method')} className="w-full text-left text-sm text-gray-500 hover:text-gray-800 transition-colors py-1">
              📘 Como funciona o método MACBETH
            </button>
            <button onClick={() => setView('manifest')} className="w-full text-left text-sm text-gray-500 hover:text-gray-800 transition-colors py-1">
              🧩 Manifesto de capacidades (para IA)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
