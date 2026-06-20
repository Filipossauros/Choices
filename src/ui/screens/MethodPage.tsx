/**
 * MACBETH method explainer + practical application of the two reference use
 * cases discussed (IS architecture evaluation; platform health/risk).
 */
export default function MethodPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-700">← Voltar ao início</button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-800">O método MACBETH</h1>
        <p className="text-gray-500 text-sm">
          <em>Measuring Attractiveness by a Categorical Based Evaluation Technique</em> — Bana e Costa &amp; Vansnick, 1994.
        </p>
      </div>

      <Section title="Ideia central">
        <p className="text-sm text-gray-600 leading-relaxed">
          Em vez de pedir números diretamente (difíceis de justificar), o MACBETH pede <strong>juízos qualitativos
          de diferença de atratividade</strong> entre pares de alternativas — de <em>Nula</em> (C0) a <em>Extrema</em> (C6).
          A partir desses juízos, deriva-se por <strong>programação linear</strong> uma escala cardinal de valor que os
          respeita, verificando ao mesmo tempo a sua <strong>consistência</strong>.
        </p>
      </Section>

      <Section title="Os quatro passos da construção">
        <ol className="space-y-2 text-sm text-gray-600 list-decimal pl-5">
          <li><strong>Critérios.</strong> Estruturar a árvore de critérios — fatores compostos que se decompõem em subcritérios, critérios de qualificação (escala graduada) e portas eliminatórias.</li>
          <li><strong>Escalas.</strong> Para cada critério-folha, comparar a atratividade entre níveis e derivar a escala cardinal, ancorada em <span className="font-mono">Neutro = 0</span> e <span className="font-mono">Bom = 100</span>.</li>
          <li><strong>Ponderação.</strong> Em cada grupo de irmãos, ponderar por oscilação (<em>swing</em>) os critérios entre si. Os pesos de cada grupo somam 1.</li>
          <li><strong>Perfis de decisão.</strong> Definir zonas de decisão (limiares) sobre o valor global, idealmente derivadas de perfis de referência.</li>
        </ol>
      </Section>

      <Section title="Agregação aditiva e hierárquica">
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          O valor global de uma alternativa é a média ponderada dos seus critérios:
        </p>
        <p className="font-mono text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
          V(p) = Σᵢ kᵢ · vᵢ(p)
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mt-2">
          Com critérios hierárquicos, cada <strong>fator composto</strong> V[F] é, por sua vez, a média ponderada
          dos seus filhos. O peso efetivo (global) de uma folha é o <strong>produto dos pesos</strong> ao longo do
          caminho até à raiz. As portas correm a montante: uma falha reprova a proposta antes da agregação.
        </p>
      </Section>

      <Section title="Exemplo 1 — Avaliação de arquiteturas de SI">
        <p className="text-sm text-gray-600 leading-relaxed">
          Avaliar propostas de arquitetura por fatores estruturados. Cada fator agrega subcritérios próprios:
        </p>
        <TreeBlock lines={[
          'root — Avaliação de arquitetura',
          '├── Segurança (fator)',
          '│   ├── Autenticação (qualificação)',
          '│   ├── Cifra de dados (qualificação)',
          '│   └── Conformidade RGPD (porta — eliminatória)',
          '├── Interoperabilidade (fator)',
          '└── Escolhas tecnológicas (fator)',
          '     ├── Maturidade',
          '     └── Suporte da comunidade',
        ]} />
        <p className="text-xs text-gray-500">Perfis de decisão: <b className="text-green-700">Aprovado</b> · <b className="text-amber-700">Com reservas</b> · <b className="text-red-700">Rejeitado</b>.</p>
      </Section>

      <Section title="Exemplo 2 — Monitorização e risco de plataforma">
        <p className="text-sm text-gray-600 leading-relaxed">
          Compor um <strong>HealthStatus</strong> a partir de métricas técnicas e um fator <strong>Risco</strong> que o
          pondera com criticidade, duração e responsabilidade. O risco resultante mapeia para uma ação.
        </p>
        <TreeBlock lines={[
          'root — Risco',
          '├── HealthStatus (fator)',
          '│   ├── Latência (qualificação · contínuo)',
          '│   ├── Taxa de erros (qualificação · contínuo)',
          '│   └── Saturação (qualificação · contínuo)',
          '├── Criticidade (qualificação)',
          '├── Duração (qualificação)',
          '└── Responsabilidade (qualificação)',
        ]} />
        <p className="text-xs text-gray-500">Perfis de decisão: <b className="text-green-700">Nenhuma ação</b> · <b className="text-amber-700">Advertência</b> · <b className="text-red-700">Sanção/coima</b>.</p>
      </Section>

      <Section title="Consistência">
        <p className="text-sm text-gray-600 leading-relaxed">
          Cada matriz de juízos é validada por uma margem de consistência <span className="font-mono">z</span>: se{' '}
          <span className="font-mono">z &gt; 0</span>, os juízos são compatíveis e a escala (ou os pesos) é derivável;
          caso contrário, a aplicação sinaliza as contradições para revisão.
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
