/**
 * MACBETH method explainer + practical application of the two reference use
 * cases discussed (IS architecture evaluation; platform health/risk).
 */
import { useTranslation } from 'react-i18next';

export default function MethodPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700">{t('← Voltar ao início')}</button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-800">{t('O método MACBETH')}</h1>
        <p className="text-gray-500 text-sm">
          <em>Measuring Attractiveness by a Categorical Based Evaluation Technique</em> — Bana e Costa &amp; Vansnick, 1994.
        </p>
      </div>

      <Section title={t('Ideia central')}>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t('Em vez de pedir números diretamente (difíceis de justificar), o MACBETH pede juízos qualitativos de diferença de atratividade entre pares de alternativas — de Nula (C0) a Extrema (C6). A partir desses juízos, deriva-se por programação linear uma escala cardinal de valor que os respeita, verificando ao mesmo tempo a sua consistência.')}
        </p>
      </Section>

      <Section title={t('Os quatro passos da construção')}>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal pl-5">
          <li>{t('Critérios. Estruturar a árvore de critérios — fatores compostos que se decompõem em subcritérios, critérios de qualificação (escala graduada) e condições eliminatórias.')}</li>
          <li>{t('Escalas. Para cada critério-folha, comparar a atratividade entre níveis e derivar a escala cardinal, ancorada em Neutro = 0 e Bom = 100.')}</li>
          <li>{t('Ponderação. Em cada grupo de irmãos, ponderar por oscilação (swing) os critérios entre si. Os pesos de cada grupo somam 1.')}</li>
          <li>{t('Perfis de decisão. Definir zonas de decisão (limiares) sobre o valor global, idealmente derivadas de perfis de referência.')}</li>
        </ol>
      </Section>

      <Section title={t('Agregação aditiva e hierárquica')}>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          {t('O valor global de uma alternativa é a média ponderada dos seus critérios:')}
        </p>
        <p className="font-mono text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
          V(p) = Σᵢ kᵢ · vᵢ(p)
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          {t('Com critérios hierárquicos, cada fator composto V[F] é, por sua vez, a média ponderada dos seus filhos. O peso efetivo (global) de uma folha é o produto dos pesos ao longo do caminho até à raiz. As condições eliminatórias correm a montante: uma falha reprova a proposta antes da agregação.')}
        </p>
      </Section>

      <Section title={t('Exemplo 1 — Avaliação de arquiteturas de SI')}>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t('Avaliar propostas de arquitetura por fatores estruturados. Cada fator agrega subcritérios próprios:')}
        </p>
        <TreeBlock lines={[
          t('root — Avaliação de arquitetura'),
          t('├── Segurança (fator)'),
          t('│   ├── Autenticação (qualificação)'),
          t('│   ├── Cifra de dados (qualificação)'),
          t('│   └── Conformidade RGPD (condição eliminatória)'),
          t('├── Interoperabilidade (fator)'),
          t('└── Escolhas tecnológicas (fator)'),
          t('     ├── Maturidade'),
          t('     └── Suporte da comunidade'),
        ]} />
        <p className="text-xs text-gray-500">{t('Perfis de decisão:')} <b className="text-green-700">{t('Aprovado')}</b> · <b className="text-amber-700">{t('Com reservas')}</b> · <b className="text-red-700">{t('Rejeitado')}</b>.</p>
      </Section>

      <Section title={t('Exemplo 2 — Monitorização e risco de plataforma')}>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t('Compor um HealthStatus a partir de métricas técnicas e um fator Risco que o pondera com criticidade, duração e responsabilidade. O risco resultante mapeia para uma ação.')}
        </p>
        <TreeBlock lines={[
          t('root — Risco'),
          t('├── HealthStatus (fator)'),
          t('│   ├── Latência (qualificação · contínuo)'),
          t('│   ├── Taxa de erros (qualificação · contínuo)'),
          t('│   └── Saturação (qualificação · contínuo)'),
          t('├── Criticidade (qualificação)'),
          t('├── Duração (qualificação)'),
          t('└── Responsabilidade (qualificação)'),
        ]} />
        <p className="text-xs text-gray-500">{t('Perfis de decisão:')} <b className="text-green-700">{t('Nenhuma ação')}</b> · <b className="text-amber-700">{t('Advertência')}</b> · <b className="text-red-700">{t('Sanção/coima')}</b>.</p>
      </Section>

      <Section title={t('Consistência')}>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t('Cada matriz de juízos é validada por uma margem de consistência z: se z > 0, os juízos são compatíveis e a escala (ou os pesos) é derivável; caso contrário, a aplicação sinaliza as contradições para revisão.')}
        </p>
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

function TreeBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="text-xs font-mono bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 overflow-x-auto whitespace-pre">
      {lines.join('\n')}
    </pre>
  );
}
