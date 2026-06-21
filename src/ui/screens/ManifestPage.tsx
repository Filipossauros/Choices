import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCapabilitiesManifest, downloadJson } from '../../domain/modelSpec';

/**
 * Capabilities manifest — a human page that doubles as an AI-agent briefing on
 * what Choices does and how its data is shaped. Exportable as JSON so an agent
 * can ingest the app's capabilities before building examples.
 */
export default function ManifestPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const manifest = useMemo(() => buildCapabilitiesManifest(), []);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700">{t('← Voltar ao início')}</button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-800">{t('Manifesto de capacidades')}</h1>
          <p className="text-gray-500 max-w-xl text-sm">{t(manifest.purpose)}</p>
        </div>
        <button
          onClick={() => downloadJson('choices-manifesto.json', manifest)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
        >
          ↓ {t('Exportar manifesto (JSON · IA)')}
        </button>
      </div>

      <Section title={t('Método')}>
        <p className="text-sm text-gray-600">
          <strong>{manifest.method.name}</strong> — {t(manifest.method.description)}{' '}
          <span className="text-gray-400 italic">({manifest.method.reference})</span>
        </p>
      </Section>

      <Section title={t('Entidades')}>
        <ul className="space-y-2">
          {manifest.entities.map((e) => (
            <li key={e.name} className="text-sm">
              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{e.name}</code>
              <span className="text-gray-600"> — {t(e.description)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('Fluxos')}>
        <div className="grid sm:grid-cols-2 gap-3">
          {manifest.flows.map((f) => (
            <div key={f.id} className="border border-gray-200 rounded-lg p-3 space-y-1">
              <p className="font-medium text-gray-800 text-sm">{t(f.name)}</p>
              <p className="text-xs text-gray-500">{t(f.description)}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {f.steps.map((s, i) => (
                  <span key={s} className="text-[11px] text-gray-600">
                    {i > 0 && <span className="text-gray-300 mr-1">→</span>}{t(s)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('Tipos de critério')}>
        <ul className="space-y-1.5">
          {manifest.criterionTypes.map((ct) => (
            <li key={ct.type} className="text-sm">
              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{ct.type}</code>
              <span className="text-gray-600"> — {t(ct.description)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('Capacidades')}>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
          {manifest.capabilities.map((c, i) => <li key={i}>{t(c)}</li>)}
        </ul>
      </Section>

      <Section title={t('Exportações')}>
        <ul className="space-y-1.5">
          {manifest.exports.map((x) => (
            <li key={x.id} className="text-sm">
              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{x.id}</code>
              <span className="text-gray-600"> — {t(x.description)}</span>
              {x.schema && <span className="text-gray-400 italic"> ({x.schema})</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('Exemplos de uso')}>
        <div className="space-y-3">
          {manifest.exampleUseCases.map((u) => (
            <div key={u.name} className="border border-gray-200 rounded-lg p-3 space-y-1">
              <p className="font-medium text-gray-800 text-sm">{t(u.name)}</p>
              <p className="text-xs text-gray-500">{t(u.description)}</p>
              <p className="text-xs font-mono text-gray-600 bg-gray-50 rounded px-2 py-1">{t(u.structure)}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-2">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      {children}
    </section>
  );
}
