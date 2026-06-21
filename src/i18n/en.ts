/**
 * English overrides keyed by the Portuguese source string (natural keys).
 * Strings with values use i18next interpolation placeholders ({{x}}).
 */
export const en: Record<string, string> = {
  // ── Global chrome / header ──────────────────────────────────────────────
  'Criação do modelo': 'Model creation',
  'Aplicação do modelo': 'Model application',
  'Editar modelo (cópia)': 'Edit model (copy)',
  'Cria uma cópia editável do modelo desta avaliação — não altera o original nem esta avaliação':
    'Creates an editable copy of this evaluation’s model — leaves the original and this evaluation untouched',
  'Mudar para modo claro': 'Switch to light mode',
  'Mudar para modo escuro': 'Switch to dark mode',
  'Modo claro': 'Light mode',
  'Modo escuro': 'Dark mode',
  'Mudar para português': 'Switch to Portuguese',
  'Mudar para inglês': 'Switch to English',
  Idioma: 'Language',

  // Nav step labels
  Início: 'Home',
  Critérios: 'Criteria',
  'Perfis de decisão': 'Decision profiles',
  Escalas: 'Scales',
  Ponderação: 'Weighting',
  Resumo: 'Summary',
  'Análise e avaliação': 'Analysis & evaluation',
  Resultados: 'Results',
  Sensibilidade: 'Sensitivity',
  Relatório: 'Report',

  // ── ScreenNav ───────────────────────────────────────────────────────────
  'Próximo:': 'Next:',
  'Defina os critérios antes de avançar.': 'Define the criteria before continuing.',
  'Adicione pelo menos um critério para continuar.': 'Add at least one criterion to continue.',
  'Derive as escalas de todos os critérios antes de avançar.':
    'Derive the scales of every criterion before continuing.',
  'Derive e valide a escala de todos os critérios antes de avançar.':
    'Derive and validate the scale of every criterion before continuing.',
  'Analise a robustez dos resultados à variação dos pesos.':
    'Analyse how robust the results are to weight variation.',
  'Gere e exporte o relatório de decisão.': 'Generate and export the decision report.',

  // ── Home ────────────────────────────────────────────────────────────────
  'O que vais decidir hoje?': 'What will you decide today?',
  'Avaliação multicritério, estruturada e defensável — para qualquer alternativa ou cenário.':
    'Multicriteria evaluation — structured and defensible — for any alternative or scenario.',
  'Criar modelo de avaliação': 'Create an evaluation model',
  'Definir critérios, escalas de valor, pesos e perfis de decisão.':
    'Define criteria, value scales, weights and decision profiles.',
  '+ Novo modelo': '+ New model',
  'Avaliar alternativas': 'Evaluate alternatives',
  'Aplicar um modelo a um conjunto concreto de alternativas e obter resultados.':
    'Apply a model to a concrete set of alternatives and get results.',
  'Cria um modelo primeiro.': 'Create a model first.',
  '+ Nova avaliação': '+ New evaluation',
  'Escolher modelo a avaliar…': 'Choose a model to apply…',
  'Modelos disponíveis': 'Available models',
  'Mostrar menos': 'Show less',
  'Ver todos ({{n}})': 'See all ({{n}})',
  'Ver todas ({{n}})': 'See all ({{n}})',
  'A importar…': 'Importing…',
  'Importar JSON': 'Import JSON',
  'Ainda sem modelos. Cria um do zero, importa um JSON ou usa um modelo-base à direita.':
    'No models yet. Create one from scratch, import a JSON, or use a starter model on the right.',
  Editar: 'Edit',
  Avaliar: 'Evaluate',
  'Avaliações recentes': 'Recent evaluations',
  'Sem avaliações em curso. Inicia uma nova avaliação acima ou importa um JSON de uma avaliação anterior.':
    'No evaluations in progress. Start a new one above or import a JSON from a previous evaluation.',
  Abrir: 'Open',
  'Modelos-base': 'Starter models',
  'Arranca de um exemplo completo e adapta.': 'Start from a complete example and adapt it.',
  'Avaliação de arquiteturas de SI': 'IS architecture evaluation',
  'Risco / monitorização de plataforma': 'Platform risk / monitoring',
  '3 fatores · 5 critérios · 1 porta': '3 factors · 5 criteria · 1 gate',
  'HealthStatus + 3 métricas contínuas': 'HealthStatus + 3 continuous metrics',
  'Como funciona o método MACBETH': 'How the MACBETH method works',
  'Manifesto de capacidades (para IA)': 'Capabilities manifest (for AI)',
  'Eliminar este modelo?': 'Delete this model?',
  'Eliminar esta análise?': 'Delete this evaluation?',
  'Erro ao importar: ': 'Import error: ',

  // ── Criteria ────────────────────────────────────────────────────────────
  'Novo nível': 'New level',
  'Ordenados do mais para o menos atrativo (↑ = melhor)': 'Ordered from most to least attractive (↑ = better)',
  'Descrição do nível': 'Level description',
  Neutro: 'Neutral',
  Bom: 'Good',
  Veto: 'Veto',
  'Veto: reprova abaixo deste nível': 'Veto: fails below this level',
  'Remover nível': 'Remove level',
  '+ Adicionar nível': '+ Add level',
  'Introduza um nome para o critério.': 'Enter a name for the criterion.',
  'São necessários pelo menos 2 níveis.': 'At least 2 levels are required.',
  Nome: 'Name',
  'Ex.: Segurança, Latência, Custo…': 'e.g. Security, Latency, Cost…',
  'Descrição (opcional)': 'Description (optional)',
  Tipo: 'Type',
  'Fator composto (decompõe em subcritérios)': 'Composite factor (decomposes into sub-criteria)',
  'Qualificação (escala graduada)': 'Qualification (graded scale)',
  'Porta (habilitação binária)': 'Gate (binary eligibility)',
  'Este fator tem subcritérios. Remova-os para mudar o tipo.':
    'This factor has sub-criteria. Remove them to change its type.',
  'Um fator composto agrega os seus subcritérios por ponderação. Depois de o guardar, use «+ subcritério» para o decompor. A sua pontuação é calculada a partir dos filhos.':
    'A composite factor aggregates its sub-criteria by weighting. After saving it, use «+ sub-criterion» to decompose it. Its score is computed from its children.',
  'Descritor de Desempenho': 'Performance descriptor',
  'Permitir desempenho contínuo (posição entre níveis, lida da curva suave)':
    'Allow continuous performance (position between levels, read from the smooth curve)',
  'Guardar critério': 'Save criterion',
  Cancelar: 'Cancel',
  Eliminar: 'Delete',
  Fator: 'Factor',
  Qualificação: 'Qualification',
  Porta: 'Gate',
  'Eliminar este fator e todos os seus subcritérios?': 'Delete this factor and all its sub-criteria?',
  'Eliminar este critério?': 'Delete this criterion?',
  Colapsar: 'Collapse',
  Expandir: 'Expand',
  '{{n}} níveis · Neutro: «{{neutral}}» · Bom: «{{good}}»':
    '{{n}} levels · Neutral: «{{neutral}}» · Good: «{{good}}»',
  ' · contínuo': ' · continuous',
  ' · Veto: «{{veto}}»': ' · Veto: «{{veto}}»',
  '{{n}} subcritério(s)': '{{n}} sub-criteria',
  '+ subcritério': '+ sub-criterion',
  '+ subcritério em «{{label}}»': '+ sub-criterion in «{{label}}»',
  'Designação do modelo': 'Model name',
  'Exportar modelo': 'Export model',
  'Árvore de critérios': 'Criteria tree',
  '{{n}} fator(es) · ': '{{n}} factor(s) · ',
  '{{n}} folha(s)': '{{n}} leaf(s)',
  'Ainda sem critérios. Adicione um fator composto, um critério de qualificação ou uma porta.':
    'No criteria yet. Add a composite factor, a qualification criterion, or a gate.',
  '+ Adicionar critério ou fator': '+ Add criterion or factor',

  // ── Judgment components (ConsistencyBadge / GuidedJudgments / Matrix) ────
  'A verificar…': 'Checking…',
  '✓ Consistente (z = {{z}})': '✓ Consistent (z = {{z}})',
  '✗ Inconsistente ({{n}} pares)': '✗ Inconsistent ({{n}} pairs)',
  'São necessários pelo menos 2 elementos.': 'At least 2 elements are required.',
  Indiferente: 'Indifferent',
  'Muito fraca': 'Very weak',
  Fraca: 'Weak',
  Moderada: 'Moderate',
  Forte: 'Strong',
  'Muito forte': 'Very strong',
  Extrema: 'Extreme',
  'C0 — a diferença não tem relevância prática': 'C0 — the difference has no practical relevance',
  'C1 — diferença quase imperceptível': 'C1 — almost imperceptible difference',
  'C2 — diferença pequena mas perceptível': 'C2 — small but perceptible difference',
  'C3 — diferença claramente sentida': 'C3 — clearly felt difference',
  'C4 — diferença significativa': 'C4 — significant difference',
  'C5 — diferença muito marcada': 'C5 — very marked difference',
  'C6 — diferença máxima concebível': 'C6 — maximum conceivable difference',
  'Pergunta {{n}} de {{total}}': 'Question {{n}} of {{total}}',
  '{{a}}/{{total}} respondidas': '{{a}}/{{total}} answered',
  'Diferença de atratividade': 'Attractiveness difference',
  '✓ Resposta registada:': '✓ Answer recorded:',
  '← Anterior': '← Previous',
  'Próxima →': 'Next →',
  'Referência MACBETH — categorias C0–C6': 'MACBETH reference — categories C0–C6',
  'As categorias são ordinais: a diferença C4 (Forte) deve ser maior que C3 (Moderada), e assim por diante. A verificação de consistência confirma que a ordenação cardinal das respostas não contém contradições.':
    'The categories are ordinal: the C4 (Strong) difference must exceed C3 (Moderate), and so on. The consistency check confirms the cardinal ordering of the answers has no contradictions.',
  // Matrix editor
  Nula: 'None',
  'Preencha a diferença de atratividade entre cada par (linha mais atrativa que coluna). Para juízos intervalares, ajuste o limite superior.':
    'Fill in the attractiveness difference for each pair (row more attractive than column). For interval judgments, adjust the upper bound.',
  'O segundo campo define o limite superior de um juízo intervalar (ex.: Moderada–Forte).':
    'The second field sets the upper bound of an interval judgment (e.g. Moderate–Strong).',
  'Diferenças de atratividade inconsistentes (realçadas a vermelho na matriz):':
    'Inconsistent attractiveness differences (highlighted in red in the matrix):',
  atual: 'current',
  sugerido: 'suggested',
  Aplicar: 'Apply',
  'A matriz é inconsistente, mas o conflito resulta da combinação de vários juízos (um ciclo) e não de um único par isolável. Reveja as diferenças de atratividade — sobretudo as que envolvem categorias muito próximas entre si ou muito afastadas.':
    'The matrix is inconsistent, but the conflict comes from a combination of several judgments (a cycle) rather than a single isolable pair. Review the attractiveness differences — especially those involving categories very close to or very far from each other.',
  'Diferença inconsistente: {{a}} vs {{b}}': 'Inconsistent difference: {{a}} vs {{b}}',

  // ── Scales ──────────────────────────────────────────────────────────────
  PONTOS: 'POINTS',
  intervalo: 'range',
  'Escala cardinal — curva suave (interpolação monótona) do nível menos atrativo (esquerda) ao mais atrativo (direita)':
    'Cardinal scale — smooth curve (monotone interpolation) from the least attractive level (left) to the most attractive (right)',
  'Valores cardinais derivados (a curva passa exatamente por estes pontos):':
    'Derived cardinal values (the curve passes exactly through these points):',
  'A escala de valor é a interpolação monótona-cúbica (PCHIP) que passa por todos os pontos derivados — suave (sem pontos de corte) e sem oscilações. Âncoras: Neutro = 0, Bom = 100. Desempenhos contínuos são lidos diretamente desta curva.':
    'The value scale is the monotone-cubic (PCHIP) interpolation passing through every derived point — smooth (no kinks) and without overshoot. Anchors: Neutral = 0, Good = 100. Continuous performances are read directly from this curve.',
  'Sem critérios de qualificação definidos.': 'No qualification criteria defined.',
  '✓ Derivada': '✓ Derived',
  '✗ Inconsistente': '✗ Inconsistent',
  'Por derivar': 'Not derived',
  'A derivar…': 'Deriving…',
  'Derivar escala': 'Derive scale',
  'Qual a diferença de atratividade de passar de': 'What is the attractiveness difference of going from',
  para: 'to',
  'Matriz de juízos': 'Judgment matrix',
  'Escala Derivada': 'Derived scale',
  'margem: {{m}}': 'margin: {{m}}',
  'Escala inconsistente — os juízos contêm contradições cardinais. Revise a matriz acima: corrija pares de diferença de atratividade que violem a ordenação cardinal (p.ex. uma diferença «Forte» numa distância menor do que uma «Fraca»).':
    'Inconsistent scale — the judgments contain cardinal contradictions. Review the matrix above: fix attractiveness-difference pairs that violate the cardinal ordering (e.g. a «Strong» difference over a smaller distance than a «Weak» one).',
  'Régua de valor — níveis posicionados proporcionalmente ao seu valor cardinal':
    'Value ruler — levels positioned proportionally to their cardinal value',
};
