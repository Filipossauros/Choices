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
  'Condição eliminatória (sim/não)': 'Eliminatory condition (yes/no)',
  'Condição eliminatória': 'Eliminatory condition',
  'Habilitação — Nível 1 (eliminatório)': 'Eligibility — Tier 1 (eliminatory)',
  'Registe as propostas, responda às condições eliminatórias e classifique o desempenho em cada critério de qualificação. Uma condição eliminatória não cumprida reprova a proposta antes da agregação.':
    'Register the proposals, answer the eliminatory conditions and rate performance on each qualification criterion. An unmet eliminatory condition rejects the proposal before aggregation.',
  'Registe as posições / momentos, responda às condições eliminatórias e classifique o desempenho em cada critério de qualificação. Uma condição eliminatória não cumprida exclui a posição antes da agregação.':
    'Register the positions / moments, answer the eliminatory conditions and rate performance on each qualification criterion. An unmet eliminatory condition excludes the position before aggregation.',
  '{{filled}} de {{expected}} desempenhos preenchidos': '{{filled}} of {{expected}} performances filled in',
  'deslize a tabela na horizontal para ver todos os critérios': 'scroll the table sideways to see every criterion',
  'Dê um nome a cada alternativa que quer comparar ({{example}}) e classifique-a depois nos {{n}} critérios do modelo.':
    'Name each alternative you want to compare ({{example}}), then rate it on the model’s {{n}} criteria.',
  'ex.: «Proposta A», «Solução do fornecedor X»': 'e.g. «Proposal A», «Vendor X’s solution»',
  'ex.: «Janeiro», «Fevereiro»': 'e.g. «January», «February»',
  // Model readiness / snapshot recovery
  'Ainda não é possível calcular resultados': 'Results cannot be computed yet',
  'A avaliação usa uma cópia do modelo tal como estava quando começou. Nessa cópia falta: {{missing}}.':
    'The evaluation uses a copy of the model as it stood when it began. That copy is missing: {{missing}}.',
  'Este modelo ainda não produz resultados.': 'This model cannot produce results yet.',
  'Falta: {{missing}}. Pode registar desempenhos agora, mas os Resultados só ficam disponíveis depois de o modelo estar completo.':
    'Missing: {{missing}}. You can record performances now, but Results only become available once the model is complete.',
  'Já existe uma versão concluída deste modelo na biblioteca — pode trazê-la para aqui sem perder os desempenhos já registados.':
    'A finished version of this model already exists in the library — you can bring it here without losing the performances already recorded.',
  'A versão na biblioteca também ainda não está completa. Termine-a e volte aqui para a trazer.':
    'The library version is not complete either. Finish it and come back to bring it in.',
  'O modelo de origem já não está na biblioteca. Abra-o para o completar e guardar.':
    'The source model is no longer in the library. Open it to complete and save it.',
  'Atualizar modelo desta avaliação': 'Update this evaluation’s model',
  'Traz a versão concluída do modelo para esta avaliação, mantendo os desempenhos já registados.':
    'Brings the finished model into this evaluation, keeping the performances already recorded.',
  'Completar o modelo': 'Complete the model',
  'critérios de qualificação': 'qualification criteria',
  'escalas consistentes ({{list}})': 'consistent scales ({{list}})',
  'ponderação de todos os grupos': 'weighting for every group',
  '«{{label}}» ainda não está pronto para avaliar — falta: {{missing}}.\n\nPode continuar e preencher os desempenhos, mas os resultados só aparecem depois de completar o modelo e atualizar esta avaliação.\n\nContinuar mesmo assim?':
    '«{{label}}» is not ready to evaluate yet — missing: {{missing}}.\n\nYou can continue and fill in performances, but results only appear once the model is complete and this evaluation is updated.\n\nContinue anyway?',
  'Os níveis de «{{label}}» mudaram, por isso a escala derivada deixa de ser válida e será apagada — terá de a derivar outra vez. Continuar?':
    'The levels of «{{label}}» changed, so the derived scale is no longer valid and will be discarded — you will have to derive it again. Continue?',
  'Responda a pelo menos uma comparação antes de derivar.': 'Answer at least one comparison before deriving.',
  'Elimina a proposta inteira.': 'Eliminates the entire proposal.',
  'Se a resposta for «não cumpre», a proposta é excluída sem chegar a ser pontuada — não é compensada por nenhum outro critério. O alcance é sempre global, mesmo que esta condição esteja dentro de um fator.':
    'If the answer is «does not comply», the proposal is excluded without ever being scored — no other criterion can compensate for it. The scope is always global, even when this condition sits inside a factor.',
  'Se «não» devesse apenas pontuar mal — admitindo compensação pelos restantes critérios — então isto não é uma condição eliminatória, mas um critério de qualificação com dois níveis.':
    'If «no» should merely score badly — allowing the remaining criteria to compensate — then this is not an eliminatory condition but a two-level qualification criterion.',
  'Converter em critério Sim/Não (pontua, não elimina)': 'Convert to a Yes/No criterion (scores, does not eliminate)',
  'Elimina a proposta inteira se não for cumprida — alcance global, não apenas neste fator.':
    'Eliminates the entire proposal if unmet — global scope, not just within this factor.',
  eliminatório: 'eliminatory',
  Eliminatório: 'Eliminatory',
  Sim: 'Yes',
  Não: 'No',
  'Arrastar para reordenar (ou ↑/↓ com o teclado)': 'Drag to reorder (or ↑/↓ with the keyboard)',
  'Reordenar «{{label}}» — posição {{i}} de {{n}}': 'Reorder «{{label}}» — position {{i}} of {{n}}',
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
  'O perfil de «{{label}}» referencia um nível que já não existe — escolha novamente esse critério. Até lá, vale o último limiar calculado.':
    'The profile of «{{label}}» references a level that no longer exists — pick that criterion again. Until then, the last computed cut-off applies.',
  'A zona «{{a}}» devia cortar acima de «{{b}}», mas o seu perfil pontua agora abaixo ({{sa}} < {{sb}}) — reveja os perfis ou a ponderação.':
    'Zone «{{a}}» should cut above «{{b}}», but its profile now scores below it ({{sa}} < {{sb}}) — review the profiles or the weighting.',
  'Há critérios de habilitação por responder — se algum falhar, a opção é eliminada independentemente da pontuação.':
    'There are unanswered gate criteria — if any fails, the option is eliminated regardless of its score.',
  'Habilitação pendente: {{gates}} — classificação provisória.':
    'Pending gates: {{gates}} — provisional classification.',
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

  // ── Results ─────────────────────────────────────────────────────────────
  posições: 'positions',
  propostas: 'proposals',
  Posição: 'Position',
  Posições: 'Positions',
  Propostas: 'Proposals',
  'Complete a ponderação (todos os grupos) no modelo para calcular resultados.':
    'Complete the weighting (all groups) in the model to compute results.',
  'Adicione {{many}} no separador «Análise e avaliação».': 'Add {{many}} in the «Analysis & evaluation» tab.',
  'A calcular resultados…': 'Computing results…',
  'A recalcular…': 'Recomputing…',
  Recalcular: 'Recompute',
  'Critério de habilitação «{{gate}}» não cumprido — eliminado antes da pontuação.':
    'Eligibility criterion «{{gate}}» not met — eliminated before scoring.',
  'Veto: «{{crit}}».': 'Veto: «{{crit}}».',
  'Eliminado antes da pontuação.': 'Eliminated before scoring.',
  'Porquê? Alavancas de melhoria': 'Why? Levers for improvement',
  'Valor Global V(p) — Modelo Aditivo': 'Global Value V(p) — Additive Model',
  'Política de decisão': 'Decision policy',
  'Perfil por Critério': 'Per-criterion profile',
  '(peso)': '(weight)',
  'Contribuição: {{c}}': 'Contribution: {{c}}',
  'V(p) global': 'V(p) global',
  'Observações por {{one}}': 'Notes per {{one}}',
  'Observações…': 'Notes…',
  'Porquê — contribuições por fator ·': 'Why — contributions by factor ·',
  'Puxaram para cima:': 'Pulled up:',
  'Contribuição para V(p) = peso efetivo × valor (acima de Neutro)':
    'Contribution to V(p) = effective weight × value (above Neutral)',
  'Mais a ganhar:': 'Most to gain:',
  'Valor ainda por ganhar até «Bom» = peso efetivo × (100 − valor)':
    'Value still to gain up to «Good» = effective weight × (100 − value)',
  '(fator)': '(factor)',
  'Barras proporcionais ao valor v(p) de cada critério (0–100). Peso ef. = peso efetivo (produto dos pesos no caminho até à raiz).':
    'Bars proportional to each criterion’s value v(p) (0–100). Eff. weight = effective weight (product of weights on the path to the root).',
  'Já está no perfil mais alto da escala de decisão.': 'Already in the highest profile of the decision scale.',
  'Todos os critérios já estão no nível máximo — só alterar pesos ou escalas mudaria o perfil «{{band}}».':
    'All criteria are already at the top level — only changing weights or scales would change the «{{band}}» profile.',
  'Para subir a «{{band}}» (≥ {{target}}):': 'To rise to «{{band}}» (≥ {{target}}):',
  melhorar: 'improve',
  'de «{{from}}» → «{{to}}» soma': 'from «{{from}}» → «{{to}}» adds',
  ' — fecha a lacuna.': ' — closes the gap.',
  ' — faltam ainda {{gap}} (combine vários critérios).': ' — still {{gap}} short (combine several criteria).',
  'Alavanca mais eficiente: maior ganho de V(p) por melhoria de um nível.':
    'Most efficient lever: largest V(p) gain per one-level improvement.',

  // ── Sensitivity ─────────────────────────────────────────────────────────
  'Navegue para «Resultados» para calcular a agregação e activar a análise de sensibilidade.':
    'Go to «Results» to compute the aggregation and enable sensitivity analysis.',
  'São necessários pelo menos 2 critérios de qualificação para a análise de sensibilidade.':
    'At least 2 qualification criteria are required for sensitivity analysis.',
  'Análise de sensibilidade': 'Sensitivity analysis',
  'O que mostra:': 'What it shows:',
  'cada linha é uma alternativa. O gráfico segue o seu valor global V(p) à medida que o peso do critério selecionado varia de 0 % a 100 %. A linha vertical tracejada (azul) marca o peso atual e as faixas coloridas de fundo são as zonas da política de decisão.':
    'each line is an alternative. The chart follows its global value V(p) as the weight of the selected criterion varies from 0 % to 100 %. The dashed vertical line (blue) marks the current weight and the coloured background bands are the decision-policy zones.',
  'O que procurar:': 'What to look for:',
  'se as linhas se cruzam, a ordenação muda nesse peso': 'if the lines cross, the ranking changes at that weight',
  '— a decisão é sensível a esse critério. Se nunca se cruzam, o resultado é robusto.':
    '— the decision is sensitive to that criterion. If they never cross, the result is robust.',
  'Critério analisado:': 'Criterion analysed:',
  'selecione para visualizar': 'select to view',
  'Sensibilidade de V(p) ao peso de «{{label}}»': 'Sensitivity of V(p) to the weight of «{{label}}»',
  'peso actual:': 'current weight:',
  'Eixo X: peso de «{{label}}» (0→100%) · Eixo Y: valor global V(p)':
    'X axis: weight of «{{label}}» (0→100%) · Y axis: global value V(p)',
  'Mudanças de ordenação detectadas:': 'Ranking changes detected:',
  '{{pair}} trocam posição': '{{pair}} swap positions',
  'A ordenação é robusta a qualquer variação do peso de «{{label}}».':
    'The ranking is robust to any variation of the weight of «{{label}}».',

  // ── Report ──────────────────────────────────────────────────────────────
  'Porta «{{gate}}» não cumprida — eliminado antes da pontuação.':
    'Gate «{{gate}}» not met — eliminated before scoring.',
  'Veto em «{{veto}}».': 'Veto on «{{veto}}».',
  'Cumpre os critérios e atinge a zona mais elevada da política de decisão.':
    'Meets the criteria and reaches the highest zone of the decision policy.',
  'Não atinge as zonas superiores da política de decisão.': 'Does not reach the upper zones of the decision policy.',
  'Atinge esta zona, mas não a zona superior da política de decisão.':
    'Reaches this zone, but not the upper zone of the decision policy.',
  'Relatório de Decisão': 'Decision Report',
  'Gerado localmente': 'Generated locally',
  'Veredito · MACBETH': 'Verdict · MACBETH',
  Exportar: 'Export',
  'Relatório completo': 'Full report',
  'Resultados tabulares': 'Tabular results',
  'JSON Decisão': 'JSON Decision',
  'Spec IA': 'AI Spec',
  'Metodologia & trilho de auditoria': 'Methodology & audit trail',
  'Metodologia — Método MACBETH': 'Methodology — MACBETH method',
  '(Bana e Costa & Vansnick, 1994). Utiliza juízos qualitativos de diferença de atratividade — de Nula a Extrema — entre pares de alternativas para construir escalas cardinais de valor por programação linear.':
    '(Bana e Costa & Vansnick, 1994). It uses qualitative attractiveness-difference judgments — from None to Extreme — between pairs of alternatives to build cardinal value scales by linear programming.',
  'O modelo de agregação é aditivo:': 'The aggregation model is additive:',
  'ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a {{one}} antes da agregação. O valor global é classificado pela escala de decisão configurada.':
    'anchored at Neutral = 0 and Good = 100. Eligibility runs upstream — any failed gate rejects the {{one}} before aggregation. The global value is classified by the configured decision scale.',
  'Trilho de Auditoria': 'Audit trail',
  'peso = {{w}}%': 'weight = {{w}}%',
  'Ver juízos ({{n}} entradas)': 'View judgments ({{n}} entries)',
  // PDF
  'Gerado localmente em: {{date}}': 'Generated locally on: {{date}}',
  Decisão: 'Decision',
  'Escala de decisão aplicada:': 'Decision scale applied:',
  Observações: 'Notes',
  'Porta: {{label}}': 'Gate: {{label}}',
  'Veto: {{label}}': 'Veto: {{label}}',
  '(Nenhum resultado calculado)': '(No result computed)',
  Metodologia: 'Methodology',
  'Este relatório utiliza o Método MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique, Bana e Costa & Vansnick, 1994). O método utiliza juízos qualitativos de diferença de atratividade — de Nula a Extrema — entre pares de alternativas para construir escalas cardinais de valor por programação linear. O modelo de agregação é aditivo: V(p) = Σᵢ kᵢ · vᵢ(p), ancorado em Neutro = 0 e Bom = 100. A habilitação corre a montante — qualquer porta falhada reprova a {{one}} antes da agregação multicritério.':
    'This report uses the MACBETH method (Measuring Attractiveness by a Categorical Based Evaluation Technique, Bana e Costa & Vansnick, 1994). The method uses qualitative attractiveness-difference judgments — from None to Extreme — between pairs of alternatives to build cardinal value scales by linear programming. The aggregation model is additive: V(p) = Σᵢ kᵢ · vᵢ(p), anchored at Neutral = 0 and Good = 100. Eligibility runs upstream — any failed gate rejects the {{one}} before multicriteria aggregation.',
  'Escala de Decisão': 'Decision Scale',
  'Zona / ação': 'Zone / action',
  'Intervalo V(p)': 'V(p) interval',
  Limiar: 'Threshold',
  Fundamentação: 'Justification',
  Manual: 'Manual',
  'Zona base (aplica-se a tudo o que não atinge as zonas acima)':
    'Base zone (applies to everything that doesn’t reach the zones above)',
  'Definido manualmente': 'Set manually',
  'Os limiares "Fundamentado" derivam de uma alternativa-limiar de referência (o pior caso ainda incluído na zona), cujo V(p) é calculado pelo modelo — rastreável e não arbitrário. "Manual" indica um valor inserido à mão.':
    'The "Grounded" thresholds derive from a reference threshold alternative (the worst case still included in the zone), whose V(p) is computed by the model — traceable and not arbitrary. "Manual" indicates a hand-entered value.',
  Descrição: 'Description',
  'Níveis (melhor → pior)': 'Levels (best → worst)',
  Peso: 'Weight',
  Nível: 'Level',
  Valor: 'Value',
  'Intervalo admissível': 'Admissible range',
  Par: 'Pair',
  Juízo: 'Judgment',
  'Choices · MACBETH · {{label}} · Página {{i}}/{{n}} · Gerado localmente':
    'Choices · MACBETH · {{label}} · Page {{i}}/{{n}} · Generated locally',

  // ── Method page ─────────────────────────────────────────────────────────
  '← Voltar ao início': '← Back to home',
  'O método MACBETH': 'The MACBETH method',
  'Ideia central': 'Core idea',
  'Em vez de pedir números diretamente (difíceis de justificar), o MACBETH pede juízos qualitativos de diferença de atratividade entre pares de alternativas — de Nula (C0) a Extrema (C6). A partir desses juízos, deriva-se por programação linear uma escala cardinal de valor que os respeita, verificando ao mesmo tempo a sua consistência.':
    'Instead of asking for numbers directly (hard to justify), MACBETH asks for qualitative attractiveness-difference judgments between pairs of alternatives — from None (C0) to Extreme (C6). From these judgments, a cardinal value scale that respects them is derived by linear programming, while its consistency is checked at the same time.',
  'Os quatro passos da construção': 'The four construction steps',
  'Critérios. Estruturar a árvore de critérios — fatores compostos que se decompõem em subcritérios, critérios de qualificação (escala graduada) e portas eliminatórias.':
    'Criteria. Structure the criteria tree — composite factors that decompose into sub-criteria, qualification criteria (graded scale) and eliminatory gates.',
  'Escalas. Para cada critério-folha, comparar a atratividade entre níveis e derivar a escala cardinal, ancorada em Neutro = 0 e Bom = 100.':
    'Scales. For each leaf criterion, compare the attractiveness between levels and derive the cardinal scale, anchored at Neutral = 0 and Good = 100.',
  'Ponderação. Em cada grupo de irmãos, ponderar por oscilação (swing) os critérios entre si. Os pesos de cada grupo somam 1.':
    'Weighting. Within each sibling group, weight the criteria against each other by swing weighting. Each group’s weights sum to 1.',
  'Perfis de decisão. Definir zonas de decisão (limiares) sobre o valor global, idealmente derivadas de perfis de referência.':
    'Decision profiles. Define decision zones (thresholds) over the global value, ideally derived from reference profiles.',
  'Agregação aditiva e hierárquica': 'Additive, hierarchical aggregation',
  'O valor global de uma alternativa é a média ponderada dos seus critérios:':
    'The global value of an alternative is the weighted average of its criteria:',
  'Com critérios hierárquicos, cada fator composto V[F] é, por sua vez, a média ponderada dos seus filhos. O peso efetivo (global) de uma folha é o produto dos pesos ao longo do caminho até à raiz. As portas correm a montante: uma falha reprova a proposta antes da agregação.':
    'With hierarchical criteria, each composite factor V[F] is itself the weighted average of its children. A leaf’s effective (global) weight is the product of the weights along the path to the root. Gates run upstream: a failure rejects the proposal before aggregation.',
  'Exemplo 1 — Avaliação de arquiteturas de SI': 'Example 1 — IS architecture evaluation',
  'Avaliar propostas de arquitetura por fatores estruturados. Cada fator agrega subcritérios próprios:':
    'Evaluate architecture proposals by structured factors. Each factor aggregates its own sub-criteria:',
  'root — Avaliação de arquitetura': 'root — Architecture evaluation',
  '├── Segurança (fator)': '├── Security (factor)',
  '│   ├── Autenticação (qualificação)': '│   ├── Authentication (qualification)',
  '│   ├── Cifra de dados (qualificação)': '│   ├── Data encryption (qualification)',
  '│   └── Conformidade RGPD (porta — eliminatória)': '│   └── GDPR compliance (gate — eliminatory)',
  '├── Interoperabilidade (fator)': '├── Interoperability (factor)',
  '└── Escolhas tecnológicas (fator)': '└── Technology choices (factor)',
  '     ├── Maturidade': '     ├── Maturity',
  '     └── Suporte da comunidade': '     └── Community support',
  'Perfis de decisão:': 'Decision profiles:',
  Aprovado: 'Approved',
  'Com reservas': 'With reservations',
  Rejeitado: 'Rejected',
  'Exemplo 2 — Monitorização e risco de plataforma': 'Example 2 — Platform monitoring and risk',
  'Compor um HealthStatus a partir de métricas técnicas e um fator Risco que o pondera com criticidade, duração e responsabilidade. O risco resultante mapeia para uma ação.':
    'Compose a HealthStatus from technical metrics and a Risk factor that weights it against criticality, duration and responsibility. The resulting risk maps to an action.',
  'root — Risco': 'root — Risk',
  '├── HealthStatus (fator)': '├── HealthStatus (factor)',
  '│   ├── Latência (qualificação · contínuo)': '│   ├── Latency (qualification · continuous)',
  '│   ├── Taxa de erros (qualificação · contínuo)': '│   ├── Error rate (qualification · continuous)',
  '│   └── Saturação (qualificação · contínuo)': '│   └── Saturation (qualification · continuous)',
  '├── Criticidade (qualificação)': '├── Criticality (qualification)',
  '├── Duração (qualificação)': '├── Duration (qualification)',
  '└── Responsabilidade (qualificação)': '└── Responsibility (qualification)',
  'Nenhuma ação': 'No action',
  Advertência: 'Warning',
  'Sanção/coima': 'Sanction/fine',
  Consistência: 'Consistency',
  'Cada matriz de juízos é validada por uma margem de consistência z: se z > 0, os juízos são compatíveis e a escala (ou os pesos) é derivável; caso contrário, a aplicação sinaliza as contradições para revisão.':
    'Each judgment matrix is validated by a consistency margin z: if z > 0, the judgments are compatible and the scale (or the weights) can be derived; otherwise, the app flags the contradictions for review.',

  // ── Manifest page (labels + manifest data) ──────────────────────────────
  'Manifesto de capacidades': 'Capabilities manifest',
  'Exportar manifesto (JSON · IA)': 'Export manifest (JSON · AI)',
  Método: 'Method',
  Entidades: 'Entities',
  Fluxos: 'Flows',
  'Tipos de critério': 'Criterion types',
  Capacidades: 'Capabilities',
  Exportações: 'Exports',
  'Exemplos de uso': 'Use examples',
  'Aplicação web local-first para construir modelos de decisão multicritério pelo método MACBETH e aplicá-los para avaliar e classificar alternativas, com critérios hierárquicos (fatores e subfatores).':
    'Local-first web app to build multicriteria decision models with the MACBETH method and apply them to evaluate and rank alternatives, with hierarchical criteria (factors and sub-factors).',
  'Measuring Attractiveness by a Categorical Based Evaluation Technique. Usa juízos qualitativos de diferença de atratividade (Nula→Extrema) entre pares para derivar escalas cardinais de valor e pesos por programação linear.':
    'Measuring Attractiveness by a Categorical Based Evaluation Technique. Uses qualitative attractiveness-difference judgments (None→Extreme) between pairs to derive cardinal value scales and weights by linear programming.',
  'Modelo reutilizável: árvore de critérios, escalas de valor, pesos por grupo e perfis de decisão. Não depende de propostas concretas.':
    'Reusable model: criteria tree, value scales, per-group weights and decision profiles. Independent of concrete proposals.',
  'Aplicação de um modelo a propostas concretas; embute um snapshot do modelo, os desempenhos e o resultado agregado.':
    'Application of a model to concrete proposals; embeds a snapshot of the model, the performances and the aggregated result.',
  'Estruturar a árvore de critérios, derivar escalas cardinais, ponderar cada grupo e definir os limiares de decisão.':
    'Structure the criteria tree, derive cardinal scales, weight each group and define the decision thresholds.',
  'Registar propostas, classificar o seu desempenho, agregar para obter V(p), analisar robustez e exportar relatório.':
    'Register proposals, rate their performance, aggregate to get V(p), analyse robustness and export a report.',
  'Fator interno que agrega os seus subcritérios por ponderação (multinível).':
    'Internal factor that aggregates its sub-criteria by weighting (multilevel).',
  'Folha com descritor de níveis ordenados; produz um valor cardinal vᵢ(p) ∈ [0,100].':
    'Leaf with an ordered-levels descriptor; produces a cardinal value vᵢ(p) ∈ [0,100].',
  'Porta binária eliminatória (cumpre/não cumpre); uma falha reprova a proposta antes da agregação.':
    'Eliminatory binary gate (pass/fail); a failure rejects the proposal before aggregation.',
  'Critérios hierárquicos com fatores e subfatores e agregação aditiva multinível.':
    'Hierarchical criteria with factors and sub-factors and multilevel additive aggregation.',
  'Derivação de escalas cardinais de valor por MACBETH com verificação de consistência (LP) e sugestões de correção.':
    'Derivation of cardinal value scales by MACBETH with consistency checking (LP) and correction suggestions.',
  'Ponderação por oscilação (swing weighting) independente por cada grupo de irmãos.':
    'Swing weighting, independent for each sibling group.',
  'Perfis de decisão com limiares derivados de perfis de referência (impacto global).':
    'Decision profiles with thresholds derived from reference profiles (global impact).',
  'Desempenhos discretos ou contínuos (curva monótona-cúbica PCHIP).':
    'Discrete or continuous performances (monotone-cubic PCHIP curve).',
  'Habilitação por portas e veto por critério.': 'Eligibility via gates and per-criterion veto.',
  'Resultados explicáveis: painel «Porquê» com contribuições por fator, pontos fortes/fracos e alavancas de melhoria para subir de perfil de decisão.':
    'Explainable results: a «Why» panel with per-factor contributions, strengths/weaknesses and levers for improvement to rise to a higher decision profile.',
  'Análise de sensibilidade dos pesos (um critério de cada vez) com deteção e localização das mudanças de ordenação.':
    'Weight sensitivity analysis (one criterion at a time) with detection and location of ranking changes.',
  'Exportação de modelo, avaliação, decisão, especificação para IA (JSON), relatório (PDF) e resultados (CSV).':
    'Export of model, evaluation, decision, AI specification (JSON), report (PDF) and results (CSV).',
  'Persistência local (IndexedDB) e importação/exportação JSON.':
    'Local persistence (IndexedDB) and JSON import/export.',
  'Interface local-first em PT-PT, domínio-agnóstica, com modo claro e escuro (dark mode).':
    'Local-first, domain-agnostic interface in PT-PT, with light and dark mode.',
  'Modelo completo, reimportável.': 'Complete, re-importable model.',
  'Avaliação completa (modelo + propostas + resultados).': 'Complete evaluation (model + proposals + results).',
  'Especificação legível por IA do modelo (fórmulas, pesos, escalas, diagnósticos).':
    'AI-readable specification of the model (formulas, weights, scales, diagnostics).',
  'Relatório de decisão em PDF.': 'Decision report in PDF.',
  'Avaliar propostas de arquitetura por fatores como segurança, interoperabilidade, escalabilidade e justificação tecnológica.':
    'Evaluate architecture proposals by factors such as security, interoperability, scalability and technological justification.',
  'root → {Segurança→{Autenticação, Cifra, RGPD(porta)}, Interoperabilidade, Escolhas tecnológicas}; perfis: Aprovado/Com reservas/Rejeitado.':
    'root → {Security→{Authentication, Encryption, GDPR(gate)}, Interoperability, Technology choices}; profiles: Approved/With reservations/Rejected.',
  'Monitorização e risco de plataforma': 'Platform monitoring and risk',
  'Compor um fator HealthStatus a partir de métricas técnicas e um fator Risco que o pondera com criticidade, duração e responsabilidade.':
    'Compose a HealthStatus factor from technical metrics and a Risk factor that weights it against criticality, duration and responsibility.',
  'root(Risco) → {HealthStatus→{Latência, Taxa de erros, Saturação}, Criticidade, Duração, Responsabilidade}; perfis: Nenhuma ação/Advertência/Sanção.':
    'root(Risk) → {HealthStatus→{Latency, Error rate, Saturation}, Criticality, Duration, Responsibility}; profiles: No action/Warning/Sanction.',
};
