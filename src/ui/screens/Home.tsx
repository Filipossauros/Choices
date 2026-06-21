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

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// pre-computed paper stack rotations
// stack right: x=150, w=46, pivot_x=173
const SR: [number, number, number][] = [
  [174,-5,186],[162,3,174],[150,-4,162],[138,5,150],
  [126,-3,138],[114,5,126],[102,-5,114],[90,3,102],
];
// stack front: x=96, w=40, pivot_x=116
const SF: [number, number, number][] = [
  [188,-4,200],[176,4,188],[164,-3,176],
];

function BalanceMascot() {
  const dark = useDarkMode();
  return (
    <>
      <style>{`
        @keyframes wb-breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4px)}}
        @keyframes wb-blink{0%,88%,100%{transform:scaleY(1)}92%,96%{transform:scaleY(0.12)}}
        @keyframes wb-ear{0%,68%,100%{transform:rotate(0deg)}73%{transform:rotate(5deg)}78%{transform:rotate(-2deg)}83%{transform:rotate(5deg)}}
        @keyframes wb-plant{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes wb-steam{0%{opacity:0.55;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-22px) scale(1.9)}}
        @keyframes wb-flicker{0%,100%{opacity:1}40%{opacity:0.82}70%{opacity:0.95}}
        @keyframes wb-mote{0%{opacity:0;transform:translateY(0)}20%{opacity:0.5}80%{opacity:0.4}100%{opacity:0;transform:translateY(-75px)}}
        @keyframes wb-flyX{0%,100%{transform:translateX(0)}25%{transform:translateX(26px)}50%{transform:translateX(0)}75%{transform:translateX(-26px)}}
        @keyframes wb-flyY{0%{transform:translateY(0)}12.5%{transform:translateY(18px)}25%{transform:translateY(0)}37.5%{transform:translateY(-18px)}50%{transform:translateY(0)}62.5%{transform:translateY(18px)}75%{transform:translateY(0)}87.5%{transform:translateY(-18px)}100%{transform:translateY(0)}}
        @keyframes wb-glow{0%,100%{opacity:0.65}50%{opacity:1}}
        @keyframes wb-sunray{0%,100%{opacity:0.9}50%{opacity:0.5}}
        @keyframes wb-startwink{0%,80%,100%{opacity:0.8}90%{opacity:0.2}}
        .wb-breath{animation:wb-breath 4s ease-in-out infinite}
        .wb-blink{animation:wb-blink 6s ease-in-out infinite;transform-origin:120px 154px}
        .wb-ear{animation:wb-ear 7s ease-in-out infinite;transform-origin:141px 134px}
        .wb-plant{animation:wb-plant 3.5s ease-in-out infinite;transform-origin:233px 166px}
        .wb-flyX{animation:wb-flyX 3s ease-in-out infinite}
        .wb-flyY{animation:wb-flyY 1.5s ease-in-out infinite}
        .wb-glow{animation:wb-glow 1.2s ease-in-out infinite}
        .wb-flicker{animation:wb-flicker 2.3s ease-in-out infinite}
        .wb-sunray{animation:wb-sunray 3s ease-in-out infinite}
        .wb-star{animation:wb-startwink 4s ease-in-out infinite}
      `}</style>
      <svg width="230" height="247" viewBox="0 0 260 280" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="wb-winclip"><rect x="18" y="30" width="70" height="88"/></clipPath>
          <linearGradient id="wb-fur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7b06a"/><stop offset="1" stopColor="#d9692c"/>
          </linearGradient>
          <linearGradient id="wb-furD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9692c"/><stop offset="1" stopColor="#a8431a"/>
          </linearGradient>
          <linearGradient id="wb-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c5436"/><stop offset="1" stopColor="#5e3c24"/>
          </linearGradient>
          <linearGradient id="wb-paper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdfaf0"/><stop offset="1" stopColor="#e7ddc4"/>
          </linearGradient>
          <radialGradient id="wb-pool" cx="0.46" cy="0.38" r="0.58">
            <stop offset="0" stopColor="#fff3c0" stopOpacity="0.75"/>
            <stop offset="0.5" stopColor="#ffe08a" stopOpacity="0.28"/>
            <stop offset="1" stopColor="#ffe08a" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="wb-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fdf6d8"/><stop offset="1" stopColor="#cdd6c0" stopOpacity="0.2"/>
          </radialGradient>
        </defs>

        {/* ── Window (left) ── */}
        <rect x="14" y="26" width="78" height="96" rx="3" fill="#26314a"/>
        <rect x="18" y="30" width="70" height="88" fill={dark ? '#33415f' : '#9ecbf0'}/>
        <g clipPath="url(#wb-winclip)">
          {dark ? (
            <>
              <circle cx="64" cy="56" r="41" fill="#fdf6d8" opacity="0.08"/>
              <circle cx="64" cy="56" r="28" fill="#fdf6d8" opacity="0.16"/>
              <circle cx="64" cy="56" r="18" fill="#fdf6d8" opacity="0.30"/>
              <circle cx="64" cy="56" r="13" fill="url(#wb-moon)"/>
              {([{x:30,y:44,d:0},{x:78,y:40,d:1.2},{x:34,y:70,d:2.1},{x:80,y:80,d:0.7},{x:50,y:96,d:1.8}]).map((s,i)=>(
                <circle key={i} cx={s.x} cy={s.y} r="1.1" fill="#fdf6d8" opacity="0.85"
                  className="wb-star" style={{animationDelay:`${s.d}s`}}/>
              ))}
            </>
          ) : (
            <>
              <g className="wb-sunray">
                {[0,45,90,135,180,225,270,315].map(a=>(
                  <line key={a}
                    x1={64+17*Math.cos(a*Math.PI/180)} y1={56+17*Math.sin(a*Math.PI/180)}
                    x2={64+24*Math.cos(a*Math.PI/180)} y2={56+24*Math.sin(a*Math.PI/180)}
                    stroke="#ffd700" strokeWidth="2.5" strokeLinecap="round"/>
                ))}
              </g>
              <circle cx="64" cy="56" r="12" fill="#ffd700"/>
              <circle cx="64" cy="56" r="9" fill="#fff176"/>
            </>
          )}
        </g>
        {/* Window dividers */}
        <line x1="53" y1="30" x2="53" y2="118" stroke="#26314a" strokeWidth="3"/>
        <line x1="18" y1="74" x2="88" y2="74" stroke="#26314a" strokeWidth="3"/>

        {/* ── Desk lamp (right, articulated) ── */}
        <rect x="196" y="180" width="34" height="6" rx="2" fill="#2a2230"/>
        <line x1="213" y1="182" x2="206" y2="120" stroke="#4a3f4a" strokeWidth="4"/>
        <line x1="206" y1="120" x2="176" y2="92" stroke="#4a3f4a" strokeWidth="4"/>
        <path d="M176 92 l-20 8 l8 18 l18 -12 z" fill="#5a4a3a"/>
        <path d="M158 100 l8 18 l-10 4 l-4 -16z" fill="#3a2f2a"/>
        {/* Lamp glow halos */}
        <circle cx="160" cy="110" r="38" fill="#fff1bc" opacity="0.07" className="wb-flicker"/>
        <circle cx="160" cy="110" r="26" fill="#fff1bc" opacity="0.14" className="wb-flicker"/>
        <circle cx="160" cy="110" r="15" fill="#fff1bc" opacity="0.26" className="wb-flicker"/>
        <circle cx="160" cy="110" r="7"  fill="#fff1bc" opacity="0.88" className="wb-flicker"/>

        {/* Light pool on desk */}
        <ellipse cx="120" cy="160" rx="110" ry="80" fill="url(#wb-pool)" className="wb-flicker"/>

        {/* Dust motes */}
        {([{x:92,y:155},{x:112,y:132},{x:132,y:158},{x:154,y:118},{x:171,y:143},{x:143,y:168},{x:122,y:128}]).map((m,i)=>(
          <circle key={i} cx={m.x} cy={m.y} r="1.2" fill="#fff2b0"
            style={{animation:`wb-mote ${3.5+i*0.4}s ease-in-out ${i*0.5}s infinite`}}/>
        ))}

        {/* ── Desk ── */}
        <rect x="0" y="186" width="260" height="94" fill="url(#wb-desk)"/>
        <rect x="0" y="186" width="260" height="5" fill="#8a6038"/>

        {/* Books (left of fox) */}
        <rect x="20" y="177" width="40" height="9" rx="1" fill="#7a9a6a"/>
        <rect x="24" y="168" width="36" height="9" rx="1" fill="#c98a4a"/>
        <rect x="18" y="159" width="42" height="9" rx="1" fill="#9a6a8a"/>

        {/* Paper stack right */}
        {SR.map(([ry,ang,py],i)=>(
          <g key={i} transform={`rotate(${ang} 173 ${py})`}>
            <rect x="150" y={ry} width="46" height="12" fill="url(#wb-paper)" stroke="#cbbf9e" strokeWidth="0.6"/>
          </g>
        ))}

        {/* Paper stack front */}
        {SF.map(([ry,ang,py],i)=>(
          <g key={i} transform={`rotate(${ang} 116 ${py})`}>
            <rect x="96" y={ry} width="40" height="12" fill="url(#wb-paper)" stroke="#cbbf9e" strokeWidth="0.6"/>
          </g>
        ))}

        {/* Plant (far right) */}
        <rect x="222" y="166" width="22" height="20" rx="2" fill="#b56a47"/>
        <g className="wb-plant">
          <path d="M233 166 q-14 -18 -6 -32" stroke="#6a9a5a" strokeWidth="3" fill="none"/>
          <path d="M233 166 q14 -16 6 -30"  stroke="#6a9a5a" strokeWidth="3" fill="none"/>
          <path d="M233 166 q0 -22 0 -36"   stroke="#6a9a5a" strokeWidth="3" fill="none"/>
        </g>

        {/* ── Fox ── */}
        <g className="wb-breath">
          {/* Left ear */}
          <polygon points="99,134 89,98 113,116" fill="url(#wb-furD)"/>
          <polygon points="101,110 101,92 111,106" fill="#f7b8a0" opacity="0.6"/>
          {/* Right ear — occasional twitch */}
          <g className="wb-ear">
            <polygon points="141,134 151,98 127,116" fill="url(#wb-furD)"/>
            <polygon points="139,110 139,92 129,106" fill="#f7b8a0" opacity="0.6"/>
          </g>
          {/* Head */}
          <ellipse cx="120" cy="156" rx="35" ry="31" fill="url(#wb-fur)"/>
          {/* Rim light */}
          <path d="M90 146 a35 31 0 0 1 60 0" fill="none" stroke="#ffe6b0" strokeWidth="2.4" opacity="0.7"/>
          {/* Muzzle */}
          <ellipse cx="120" cy="168" rx="23" ry="19" fill="#fdf3e2"/>
          {/* Tired droopy eyes */}
          <g className="wb-blink">
            <path d="M99 154 q8 5 16 0"  stroke="#3a2412" strokeWidth="3" fill="none" strokeLinecap="round"/>
            <path d="M125 154 q8 5 16 0" stroke="#3a2412" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </g>
          {/* Eye bags */}
          <path d="M101 161 q6 3 12 0" stroke="#cc9999" strokeWidth="1.4" fill="none" opacity="0.6"/>
          <path d="M127 161 q6 3 12 0" stroke="#cc9999" strokeWidth="1.4" fill="none" opacity="0.6"/>
          {/* Nose, mouth, tongue */}
          <ellipse cx="120" cy="166" rx="4" ry="2.6" fill="#3a2412"/>
          <line x1="120" y1="169" x2="120" y2="173" stroke="#3a2412" strokeWidth="2"/>
          <path d="M112 175 q8 4 16 0" stroke="#3a2412" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <ellipse cx="113" cy="177" rx="3" ry="4" fill="#ff8a80"/>
        </g>

        {/* Coffee cup (in front of fox) */}
        {[0,1,2].map(i=>(
          <circle key={i} cx={84+(i-1)*5} cy={170} r={2.4} fill="#e8e8e0"
            style={{animation:`wb-steam 2.1s ease-out ${i*0.7}s infinite`}}/>
        ))}
        <rect x="74" y="172" width="20" height="18" rx="2" fill="#cf6a52"/>
        <path d="M94 176 q8 0 8 6 q0 6 -8 6" fill="none" stroke="#cf6a52" strokeWidth="3"/>

        {/* ── Firefly / moth circling lamp ── */}
        <g className="wb-flyX" style={{transformOrigin:'160px 112px'}}>
          <g className="wb-flyY" style={{transformOrigin:'160px 112px'}}>
            <g className="wb-glow">
              <circle cx="160" cy="112" r="14" fill="#fff6a0" opacity="0.09"/>
              <circle cx="160" cy="112" r="9"  fill="#fff6a0" opacity="0.17"/>
              <circle cx="160" cy="112" r="5"  fill="#fff6a0" opacity="0.32"/>
              <circle cx="160" cy="112" r="2.5" fill="#fffde0"/>
              {/* tiny wings */}
              <ellipse cx="155" cy="109" rx="2.8" ry="1.4" fill="#fff" opacity="0.45" transform="rotate(-20 160 112)"/>
              <ellipse cx="165" cy="109" rx="2.8" ry="1.4" fill="#fff" opacity="0.45" transform="rotate(20 160 112)"/>
            </g>
          </g>
        </g>
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
