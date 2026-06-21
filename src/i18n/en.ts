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

  // ── Weighting ───────────────────────────────────────────────────────────
  'Tudo-Neutro (ref.)': 'All-Neutral (ref.)',
  'Pesos dos fatores de topo': 'Top-factor weights',
  'Pesos dentro de «{{label}}»': 'Weights within «{{label}}»',
  'único (100%)': 'single (100%)',
  'por calcular': 'to compute',
  'Este grupo tem um único critério ponderável — recebe 100% do peso dentro do grupo. Sem comparações a fazer.':
    'This group has a single weightable criterion — it gets 100% of the weight within the group. No comparisons needed.',
  'Passo 1 — Ordene os critérios por importância': 'Step 1 — Order the criteria by importance',
  'Antes de quantificar, ordene os critérios do mais para o menos importante — ou seja, aquele cuja melhoria de Neutro para Bom traria mais valor fica no topo. As perguntas seguintes seguem esta ordem, comparando sempre o critério mais importante com o menos importante, o que torna cada comparação mais natural. (Ordene primeiro; alterar a ordem depois de responder pode baralhar as respostas já dadas.)':
    'Before quantifying, order the criteria from most to least important — i.e. the one whose improvement from Neutral to Good would bring the most value goes on top. The questions below follow this order, always comparing the most important criterion with the least important, which makes each comparison more natural. (Order first; changing the order after answering may scramble the answers already given.)',
  '{{n}}º': '{{n}}',
  'Subir (mais importante)': 'Move up (more important)',
  'Descer (menos importante)': 'Move down (less important)',
  'Passo 2 — Compare a importância dos pares': 'Step 2 — Compare the importance of the pairs',
  'São necessários pelo menos 2 critérios.': 'At least 2 criteria are required.',
  'Tudo parte do nível Neutro (a referência, valor 0).': 'Everything starts at the Neutral level (the reference, value 0).',
  'Quão atrativo é levar só': 'How attractive is it to take only',
  'de Neutro até Bom?': 'from Neutral to Good?',
  'Só pode levar um critério de Neutro até Bom — os restantes ficam em Neutro.':
    'You may take only one criterion from Neutral to Good — the rest stay at Neutral.',
  'Quanto mais atrativo é escolher': 'How much more attractive is it to choose',
  'do que': 'than',
  'A calcular pesos…': 'Computing weights…',
  'Calcular pesos deste grupo': 'Compute this group’s weights',
  'Pesos derivados (Σ = 1 no grupo)': 'Derived weights (Σ = 1 in the group)',
  'grupo =': 'group =',
  'do modelo': 'of the model',
  'Peso no grupo (local)': 'Weight in group (local)',
  'Global no modelo': 'Global in model',
  'Intervalo admissível: [{{lo}}%, {{hi}}%]': 'Admissible range: [{{lo}}%, {{hi}}%]',
  'Está a ponderar': 'You are weighting',
  'dentro de «{{label}}»': 'within «{{label}}»',
  'O peso global = {{p}}% (do grupo) × peso local — é esse que pesa no resultado final.':
    'The global weight = {{p}}% (of the group) × local weight — that’s what counts in the final result.',
  'Sem critérios de qualificação. Defina-os na Estruturação.': 'No qualification criteria. Define them in Criteria.',
  'Ponderação por Oscilação (Swing Weighting)': 'Swing Weighting',
  'Compare a atratividade de oscilar cada critério de Neutro para Bom. A referência «Tudo-Neutro» é o ponto de partida (valor = 0).':
    'Compare the attractiveness of swinging each criterion from Neutral to Good. The «All-Neutral» reference is the starting point (value = 0).',
  'Existem fatores compostos: pondere os filhos dentro de cada grupo. O peso global de cada folha é o produto dos pesos ao longo do caminho até à raiz.':
    'There are composite factors: weight the children within each group. Each leaf’s global weight is the product of the weights along the path to the root.',
  'Com escalas e pesos de todos os grupos definidos, construa os perfis de decisão (limiares MACBETH).':
    'With scales and weights for all groups defined, build the decision profiles (MACBETH thresholds).',
  'Calcule pesos consistentes em todos os grupos antes de avançar.':
    'Compute consistent weights in all groups before continuing.',

  // ── Decision profiles ───────────────────────────────────────────────────
  'Nova zona de decisão': 'New decision zone',
  'As zonas «{{a}}» e «{{b}}» têm o mesmo limiar ({{s}}) — uma fica inalcançável.':
    'Zones «{{a}}» and «{{b}}» have the same threshold ({{s}}) — one becomes unreachable.',
  'O perfil de referência de «{{label}}» está incompleto — defina um nível em todos os critérios.':
    'The reference profile of «{{label}}» is incomplete — set a level for every criterion.',
  'A pontuação global V(p) ∈ [0, 100] (Neutro = 0, Bom = 100) diz quão boa é cada alternativa. Aqui define-se o que fazer com cada resultado: zonas com nome e ação (ex.: «Aceitar», «Rejeitar», «Aplicar sanção»), separadas por limiares de corte. Cada resultado cai na zona mais alta cujo limiar atinge.':
    'The global score V(p) ∈ [0, 100] (Neutral = 0, Good = 100) says how good each alternative is. Here you define what to do with each result: named zones with an action (e.g. «Accept», «Reject», «Apply sanction»), separated by cut-off thresholds. Each result falls into the highest zone whose threshold it reaches.',
  'Para que o limiar seja defensável (e não um número arbitrário), descreve-se uma alternativa-limiar de referência — o pior caso que ainda pertence à zona — e o MACBETH calcula o seu V(p). O corte fica assim ligado a uma situação concreta e rastreável. Os limiares são compensatórios; para mínimos rígidos por critério use o Veto ou uma Porta. O valor manual existe só como recurso provisório ou override assumido.':
    'So the threshold is defensible (not an arbitrary number), you describe a reference threshold alternative — the worst case that still belongs to the zone — and MACBETH computes its V(p). The cut-off is thus tied to a concrete, traceable situation. Thresholds are compensatory; for hard per-criterion minimums use a Veto or a Gate. The manual value exists only as a provisional resort or a deliberate override.',
  'A zona': 'The zone',
  'As zonas': 'The zones',
  'tem limiar manual': 'has a manual threshold',
  'têm limiar manual': 'have a manual threshold',
  '(não derivado de uma alternativa-limiar). Para uma decisão defensável, derive esses limiares a partir de um perfil de referência.':
    '(not derived from a threshold alternative). For a defensible decision, derive those thresholds from a reference profile.',
  'As Escalas e a Ponderação ainda não estão concluídas e consistentes, por isso os limiares por perfil não podem ser calculados. Pode definir limiares provisórios a número e convertê-los depois.':
    'The Scales and Weighting are not yet complete and consistent, so profile thresholds cannot be computed. You can set provisional numeric thresholds and convert them later.',
  'Cor da zona': 'Zone colour',
  'Nome da zona de decisão': 'Decision zone name',
  'Limiar fundamentado por uma alternativa-limiar (rastreável)': 'Threshold grounded on a threshold alternative (traceable)',
  Fundamentado: 'Grounded',
  'Limiar definido à mão, não derivado de um perfil': 'Threshold set by hand, not derived from a profile',
  provisório: 'provisional',
  'Zona base — apanha tudo o que não atinge as zonas acima': 'Base zone — catches everything that doesn’t reach the zones above',
  'Limiar de corte': 'Cut-off threshold',
  'Remover zona': 'Remove zone',
  Ação: 'Action',
  'O que fazer nesta zona? (ex.: aceitar a proposta, aplicar sanção…)':
    'What to do in this zone? (e.g. accept the proposal, apply a sanction…)',
  'Zona base — aplica-se a tudo o que não atinge nenhuma das zonas acima. Não tem limiar próprio.':
    'Base zone — applies to everything that doesn’t reach any of the zones above. It has no threshold of its own.',
  'Alternativa-limiar de referência': 'Reference threshold alternative',
  'Definir o limiar à mão (override assumido)': 'Set the threshold by hand (deliberate override)',
  'usar valor manual': 'use manual value',
  'Descreva o pior caso que ainda pertence a esta zona; o limiar é o seu V(p).':
    'Describe the worst case that still belongs to this zone; the threshold is its V(p).',
  'Limiar derivado por MACBETH:': 'Threshold derived by MACBETH:',
  '— (descreva todos os critérios)': '— (describe all criteria)',
  'Limiar — V(p) ≥': 'Threshold — V(p) ≥',
  pontos: 'points',
  'Definir o limiar descrevendo uma alternativa-limiar (defensável)': 'Set the threshold by describing a threshold alternative (defensible)',
  'derivar por alternativa-limiar': 'derive from threshold alternative',
  '+ Adicionar zona de decisão': '+ Add decision zone',
  'Veja a síntese do modelo (fórmula, pesos) e exporte para JSON / IA.':
    'See the model summary (formula, weights) and export to JSON / AI.',
  'Defina pelo menos uma zona de decisão.': 'Define at least one decision zone.',

  // ── Model summary ───────────────────────────────────────────────────────
  'Resumo do modelo': 'Model summary',
  'Síntese completa do critério: estrutura, fórmula de agregação e fatores de ponderação. Exporte como JSON para alimentar agentes de IA (ex.: correr diagnósticos sobre o modelo).':
    'Complete synthesis of the model: structure, aggregation formula and weighting factors. Export as JSON to feed AI agents (e.g. run diagnostics on the model).',
  'Exportar especificação (JSON · IA)': 'Export specification (JSON · AI)',
  'Exportar modelo (JSON)': 'Export model (JSON)',
  '{{n}} critério(s) de qualificação': '{{n}} qualification criteria',
  '{{n}} fator(es) composto(s)': '{{n}} composite factor(s)',
  'Escalas derivadas': 'Scales derived',
  'Pesos completos': 'Weights complete',
  'Fórmula de agregação': 'Aggregation formula',
  'Expansão por grupo': 'Expansion by group',
  'Tabela global de critérios': 'Global criteria table',
  Critério: 'Criterion',
  'Grupo (pai)': 'Group (parent)',
  'Níveis (Bom→Neutro)': 'Levels (Good→Neutral)',
  'Peso efetivo': 'Effective weight',
  '— (topo)': '— (top)',
  'veto: «{{v}}»': 'veto: «{{v}}»',
  '· contínuo': '· continuous',
  '∑ filhos': '∑ children',
  'Fatores de ponderação (por grupo)': 'Weighting factors (by group)',
  fundamentado: 'grounded',
  'Alternativa-limiar — {{ref}}': 'Threshold alternative — {{ref}}',
  'Modelo completo. Aplique-o para registar propostas e obter resultados.':
    'Model complete. Apply it to register proposals and get results.',
  'Conclua escalas e ponderação consistentes antes de aplicar.':
    'Complete consistent scales and weighting before applying.',
  'Aplicar este modelo →': 'Apply this model →',
  fator: 'factor',
  'qualif.': 'qual.',
  porta: 'gate',
  'Modelo aditivo ponderado sobre uma árvore de critérios.': 'Weighted additive model over a criteria tree.',
  'Cada fator composto V[F] é a média ponderada dos seus filhos; o peso de cada grupo soma 1.':
    'Each composite factor V[F] is the weighted average of its children; each group’s weights sum to 1.',
  'O peso efetivo (global) de uma folha é o produto dos pesos ao longo do caminho até à raiz.':
    'A leaf’s effective (global) weight is the product of the weights along the path to the root.',
  'Âncoras: vᵢ(Neutro) = 0, vᵢ(Bom) = 100. Portas (gate) são eliminatórias e não entram em V(p).':
    'Anchors: vᵢ(Neutral) = 0, vᵢ(Good) = 100. Gates are eliminatory and don’t enter V(p).',

  // ── Analysis ────────────────────────────────────────────────────────────
  posição: 'position',
  proposta: 'proposal',
  'Nome da posição / momento…': 'Position / moment name…',
  'Nome da proposta…': 'Proposal name…',
  'Posição / Momento': 'Position / Moment',
  Proposta: 'Proposal',
  'Análise e monitorização': 'Analysis & monitoring',
  'Registe as posições / momentos, verifique a habilitação (portas) e classifique o desempenho em cada critério de qualificação. Uma porta falhada exclui a posição antes da agregação.':
    'Register the positions / moments, check eligibility (gates), and rate performance on each qualification criterion. A failed gate excludes the position before aggregation.',
  'Registe as propostas, verifique a habilitação (portas) e classifique o desempenho em cada critério de qualificação. Uma porta falhada reprova a proposta antes da agregação.':
    'Register the proposals, check eligibility (gates), and rate performance on each qualification criterion. A failed gate rejects the proposal before aggregation.',
  'Eliminar esta {{subject}}?': 'Delete this {{subject}}?',
  'O modelo aplicado não tem critérios definidos.': 'The applied model has no criteria defined.',
  '+ Adicionar {{subject}}': '+ Add {{subject}}',
  'Nenhuma {{subject}} registada ainda.': 'No {{subject}} registered yet.',
  'Porta (habilitação)': 'Gate (eligibility)',
  'Critério de qualificação': 'Qualification criterion',
  ' (contínuo)': ' (continuous)',
  Cumpre: 'Pass',
  'Não cumpre': 'Fail',
  'por definir': 'to set',
  ' (Neutro)': ' (Neutral)',
  ' (Bom)': ' (Good)',
  'Habilitação (Andar 1)': 'Eligibility (Tier 1)',
  Reprovado: 'Rejected',
  Habilitado: 'Eligible',
  'Por verificar': 'To check',
  'Registe as propostas e o seu desempenho antes de agregar.':
    'Register the proposals and their performance before aggregating.',
  'Adicione pelo menos uma {{subject}} para continuar.': 'Add at least one {{subject}} to continue.',
};
