import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { repository } from '../../repository';
import type { DocMeta } from '../../repository';
import type { EvaluationModel } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';
import MethodPage from './MethodPage';
import ManifestPage from './ManifestPage';
import { IconPencil, IconClipboard, IconArchitecture, IconMonitor, IconImport } from '../components/icons';
import { v4 as uuidv4 } from 'uuid';
import type { ComponentType, SVGProps } from 'react';

// ── Mascot ────────────────────────────────────────────────────────────────────

function BalanceMascot() {
  return (
    <>
      <style>{`
        @keyframes fx-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes fx-ears  { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-3deg)} 65%{transform:rotate(3deg)} }
        @keyframes fx-tail  { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(7deg)} }
        @keyframes fx-pulse { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.08)} }
        @keyframes fx-spark { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes fx-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.08)} }
        .fx-body { animation:fx-float 4s ease-in-out infinite; display:inline-block }
        .fx-ears { animation:fx-ears  5s ease-in-out infinite; transform-origin:80px 36px }
        .fx-tail { animation:fx-tail  4.4s ease-in-out infinite; transform-origin:104px 108px }
        .fx-glow { animation:fx-pulse 4s ease-in-out infinite; transform-origin:80px 88px }
        .fx-spark{ animation:fx-spark 3s ease-in-out infinite }
        .fx-eyes { animation:fx-blink 5.5s ease-in-out infinite; transform-origin:80px 63px }
      `}</style>
      <svg className="fx-body" width="128" height="134" viewBox="0 0 160 168" overflow="visible" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="fx-aura" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#c4b5fd" stopOpacity="0.55" />
            <stop offset="1" stopColor="#c4b5fd" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* soft aura */}
        <circle className="fx-glow" cx="80" cy="88" r="64" fill="url(#fx-aura)" />

        {/* ── Tail (lateral right, low-poly facets) ── */}
        <g className="fx-tail">
          <polygon points="104,108 146,132 130,156 90,148 95,126" fill="#E8763A" />
          <polygon points="130,156 146,132 150,152 133,165" fill="#F4A55A" />
          <polygon points="130,156 90,148 108,158" fill="#C04818" />
          <polygon points="133,165 150,152 142,168 126,166" fill="#FFF8F4" />
        </g>

        {/* ── Body (sitting, origami facets) ── */}
        <polygon points="60,88 100,88 110,140 50,140" fill="#E8763A" />
        <polygon points="60,88 50,140 44,114" fill="#F4A55A" />
        <polygon points="100,88 110,140 116,113" fill="#C04818" />
        {/* belly */}
        <polygon points="68,92 92,92 97,136 63,136" fill="#FFF5EC" />
        <polygon points="68,92 92,92 80,100" fill="#FFEEDD" opacity="0.45" />

        {/* paws */}
        <ellipse cx="63" cy="144" rx="14" ry="7" fill="#E8763A" />
        <ellipse cx="97" cy="144" rx="14" ry="7" fill="#E8763A" />
        <ellipse cx="63" cy="144" rx="9"  ry="4.5" fill="#C04818" opacity="0.45" />
        <ellipse cx="97" cy="144" rx="9"  ry="4.5" fill="#C04818" opacity="0.45" />

        {/* ── Ears (angular origami, behind head) ── */}
        <g className="fx-ears">
          <polygon points="54,70 40,28 72,54" fill="#E8763A" />
          <polygon points="54,70 44,32 68,54" fill="#B83A10" />
          <polygon points="106,70 120,28 88,54" fill="#E8763A" />
          <polygon points="106,70 116,32 92,54" fill="#B83A10" />
          <polygon points="48,66 48,34 66,52" fill="#FFBBA0" opacity="0.6" />
          <polygon points="112,66 112,34 94,52" fill="#FFBBA0" opacity="0.6" />
        </g>

        {/* ── Head (low-poly faceted) ── */}
        <polygon points="54,70 80,34 106,70 80,80" fill="#F4A55A" />
        <polygon points="54,70 80,80 66,74" fill="#E8763A" />
        <polygon points="106,70 80,80 94,74" fill="#C04818" />

        {/* muzzle */}
        <polygon points="66,78 94,78 80,94" fill="#FFF5EC" />
        <polygon points="66,78 94,78 80,84" fill="#FFEEDD" opacity="0.5" />
        <ellipse cx="80" cy="78.5" rx="4.5" ry="2.8" fill="#3A1808" />
        <path d="M76,85 Q80,90 84,85" stroke="#C04818" strokeWidth="1.2" fill="none" strokeLinecap="round" />

        {/* ── Eyes (big round, triple highlight) ── */}
        <g className="fx-eyes">
          <circle cx="64" cy="62" r="9.5" fill="white" />
          <circle cx="96" cy="62" r="9.5" fill="white" />
          <circle cx="64" cy="63" r="7.5" fill="#1E0E04" />
          <circle cx="96" cy="63" r="7.5" fill="#1E0E04" />
          <circle cx="64" cy="63" r="6"   fill="#7A3808" opacity="0.35" />
          <circle cx="96" cy="63" r="6"   fill="#7A3808" opacity="0.35" />
          <circle cx="64" cy="63" r="4.5" fill="#080402" />
          <circle cx="96" cy="63" r="4.5" fill="#080402" />
          {/* main highlight */}
          <ellipse cx="66.5" cy="59"  rx="3"   ry="2.5" fill="white" />
          <ellipse cx="98.5" cy="59"  rx="3"   ry="2.5" fill="white" />
          {/* secondary highlight */}
          <circle cx="61.5" cy="66.5" r="1.5" fill="white" opacity="0.6" />
          <circle cx="93.5" cy="66.5" r="1.5" fill="white" opacity="0.6" />
          {/* tiny sparkle */}
          <circle cx="59"   cy="59"   r="1"   fill="white" opacity="0.75" />
          <circle cx="91"   cy="59"   r="1"   fill="white" opacity="0.75" />
        </g>

        {/* blush */}
        <ellipse cx="51"  cy="74" rx="7" ry="4" fill="#FF9988" opacity="0.3" />
        <ellipse cx="109" cy="74" rx="7" ry="4" fill="#FF9988" opacity="0.3" />

        {/* sparkles */}
        <path className="fx-spark" d="M20 36 l1.6 4.2 l4.2 1.6 l-4.2 1.6 l-1.6 4.2 l-1.6-4.2 l-4.2-1.6 l4.2-1.6 z" fill="#fbbf24" opacity="0.85" />
        <path className="fx-spark" d="M143 48 l1.1 3 l3 1.1 l-3 1.1 l-1.1 3 l-1.1-3 l-3-1.1 l3-1.1 z" fill="#a5b4fc" opacity="0.85" style={{ animationDelay: '1.5s' }} />
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
    subjectKind: 'proposals' as const,
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
      { id: uuidv4(), label: 'Rejeitado', minScore: 0, color: '#dc2626' },
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
    subjectKind: 'positions' as const,
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
      { id: uuidv4(), label: 'Sanção / coima', minScore: 0, color: '#dc2626' },
    ],
  };
}

const TEMPLATES: { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; meta: string; factory: () => EvaluationModel }[] = [
  { key: 'architecture', Icon: IconArchitecture, label: 'Avaliação de arquiteturas de SI', meta: '3 fatores · 5 critérios · 1 porta', factory: makeTemplateArchitecture },
  { key: 'platform', Icon: IconMonitor, label: 'Risco / monitorização de plataforma', meta: 'HealthStatus + 3 métricas contínuas', factory: makeTemplateRisco },
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
  const { t } = useTranslation();
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
    if (!confirm(t('Eliminar este modelo?'))) return;
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
    if (!confirm(t('Eliminar esta análise?'))) return;
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
      alert(t('Erro ao importar: ') + String(err));
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
      <div className="relative mb-10 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100/70">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="relative flex flex-col items-center text-center px-6 py-10">
          <BalanceMascot />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mt-3">{t('O que vais decidir hoje?')}</h1>
          <p className="text-gray-500 text-sm mt-2 max-w-md">
            {t('Avaliação multicritério, estruturada e defensável — para qualquer alternativa ou cenário.')}
          </p>
        </div>
      </div>

      {/* ── Main action cards ── */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-5 flex flex-col">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 grid place-items-center mb-2"><IconPencil className="w-5 h-5" /></div>
          <h2 className="font-bold text-indigo-900 text-base mb-1">{t('Criar modelo de avaliação')}</h2>
          <p className="text-sm text-indigo-700/70 mb-4 flex-1">
            {t('Definir critérios, escalas de valor, pesos e perfis de decisão.')}
          </p>
          <div>
            <button onClick={newModel} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              {t('+ Novo modelo')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-5 flex flex-col">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center mb-2"><IconClipboard className="w-5 h-5" /></div>
          <h2 className="font-bold text-emerald-900 text-base mb-1">{t('Avaliar alternativas')}</h2>
          <p className="text-sm text-emerald-700/70 mb-4 flex-1">
            {t('Aplicar um modelo a um conjunto concreto de alternativas e obter resultados.')}
          </p>
          <div className="space-y-2">
            {models.length === 0 ? (
              <span className="text-xs text-gray-400 italic">{t('Cria um modelo primeiro.')}</span>
            ) : !pickModel ? (
              <button onClick={() => setPickModel(true)} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                {t('+ Nova avaliação')}
              </button>
            ) : (
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => { if (e.target.value) applyModel(e.target.value); }}
                className="w-full border border-emerald-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-400"
              >
                <option value="" disabled>{t('Escolher modelo a avaliar…')}</option>
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
              <h3 className="font-semibold text-gray-800 text-sm">{t('Modelos disponíveis')}</h3>
              <div className="flex items-center gap-3">
                {models.length > 3 && (
                  <button onClick={() => setShowAllModels(!showAllModels)} className="text-xs text-indigo-600 hover:underline">
                    {showAllModels ? t('Mostrar menos') : t('Ver todos ({{n}})', { n: models.length })}
                  </button>
                )}
                <label className={`text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer inline-flex items-center gap-1 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {importing ? t('A importar…') : <><IconImport className="w-3.5 h-3.5" /> {t('Importar JSON')}</>}
                  <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'create')} />
                </label>
              </div>
            </div>
            {recentModels.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-400 italic">
                {t('Ainda sem modelos. Cria um do zero, importa um JSON ou usa um modelo-base à direita.')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentModels.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{m.label}</p>
                      <StatusPill updatedAt={m.updatedAt} />
                    </div>
                    <button onClick={() => editModel(m.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{t('Editar')}</button>
                    <button onClick={() => applyModel(m.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">{t('Avaliar')}</button>
                    <button onClick={() => deleteModel(m.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Evaluations */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">{t('Avaliações recentes')}</h3>
              <div className="flex items-center gap-3">
                {evaluations.length > 2 && (
                  <button onClick={() => setShowAllEvals(!showAllEvals)} className="text-xs text-indigo-600 hover:underline">
                    {showAllEvals ? t('Mostrar menos') : t('Ver todas ({{n}})', { n: evaluations.length })}
                  </button>
                )}
                <label className={`text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer inline-flex items-center gap-1 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  {importing ? t('A importar…') : <><IconImport className="w-3.5 h-3.5" /> {t('Importar JSON')}</>}
                  <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'apply')} />
                </label>
              </div>
            </div>
            {recentEvals.length === 0 ? (
              <p className="px-4 py-5 text-sm text-gray-400 italic">
                {t('Sem avaliações em curso. Inicia uma nova avaliação acima ou importa um JSON de uma avaliação anterior.')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentEvals.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{e.label}</p>
                      <StatusPill updatedAt={e.updatedAt} />
                    </div>
                    <button onClick={() => resumeEvaluation(e.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{t('Abrir')}</button>
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
            <h3 className="font-semibold text-gray-800 text-sm mb-1">{t('Modelos-base')}</h3>
            <p className="text-xs text-gray-400 mb-3">{t('Arranca de um exemplo completo e adapta.')}</p>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => fromTemplate(tpl.factory)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="font-medium text-gray-800 text-sm group-hover:text-indigo-700 flex items-center gap-2">
                    <tpl.Icon className="w-4 h-4 text-indigo-500" /> {t(tpl.label)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 pl-6">{t(tpl.meta)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <button onClick={() => setView('method')} className="w-full text-left text-sm text-gray-500 hover:text-gray-800 transition-colors py-1">
              📘 {t('Como funciona o método MACBETH')}
            </button>
            <button onClick={() => setView('manifest')} className="w-full text-left text-sm text-gray-500 hover:text-gray-800 transition-colors py-1">
              🧩 {t('Manifesto de capacidades (para IA)')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
