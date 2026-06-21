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
};
