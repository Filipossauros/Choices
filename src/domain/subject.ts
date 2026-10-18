/**
 * What a model evaluates, in the model's own words.
 *
 * The app is domain-agnostic, but the create flow had "proposta" written into
 * its central question — a model measuring webservice performance asked "qual
 * das duas propostas escolhe?" about two latency levels. The noun now belongs to
 * the model: chosen once in Estrutura, used in every question after that.
 *
 * `subjectKind` is the previous two-valued field and is still read, so models
 * saved before this keep their wording.
 */

export interface SubjectNoun {
  one: string;
  many: string;
  One: string;
  Many: string;
  /** Definite article agreeing with the noun — so copy never writes "o proposta". */
  art: string;
  artMany: string;
}

/** What the model stores: a singular, a plural, and the gender of both. */
export interface SubjectWords {
  one: string;
  many: string;
  /** Feminine. Carried explicitly for the presets; guessed for typed nouns. */
  f?: boolean;
}

/**
 * Gender of a typed noun, for the article in front of it. Portuguese is regular
 * enough here that the common cases are covered: -a, -ção/-são, -dade, -gem are
 * feminine; the rest default to masculine. The presets carry `f` explicitly, so
 * this only ever guesses about a word the user typed.
 */
function guessFeminine(word: string): boolean {
  const w = word.trim().toLocaleLowerCase('pt');
  return /(a|ção|são|dade|gem|ice|ez)s?$/.test(w);
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase('pt') + s.slice(1) : s);

const DEFAULT: SubjectWords = { one: 'proposta', many: 'propostas', f: true };
const POSITIONS: SubjectWords = { one: 'posição', many: 'posições', f: true };

/**
 * The nouns offered without typing. Deliberately short: the point is that the
 * list is not exhaustive, so "outro…" is a first-class option rather than an
 * escape hatch.
 */
export const SUBJECT_PRESETS: SubjectWords[] = [
  DEFAULT,
  { one: 'alternativa', many: 'alternativas', f: true },
  { one: 'opção', many: 'opções', f: true },
  { one: 'serviço', many: 'serviços' },
  { one: 'fornecedor', many: 'fornecedores' },
  { one: 'candidato', many: 'candidatos' },
  { one: 'cenário', many: 'cenários' },
  POSITIONS,
];

export function subjectWords(model: {
  subject?: { one: string; many: string };
  subjectKind?: 'proposals' | 'positions';
}): SubjectWords {
  const s = model.subject;
  if (s && s.one.trim() && s.many.trim()) {
    const one = s.one.trim();
    const many = s.many.trim();
    const preset = SUBJECT_PRESETS.find((p) => p.one === one && p.many === many);
    return { one, many, f: preset?.f ?? guessFeminine(one) };
  }
  return model.subjectKind === 'positions' ? POSITIONS : DEFAULT;
}

export function subjectNoun(model: {
  subject?: { one: string; many: string };
  subjectKind?: 'proposals' | 'positions';
}): SubjectNoun {
  const { one, many, f } = subjectWords(model);
  return { one, many, One: cap(one), Many: cap(many), art: f ? 'a' : 'o', artMany: f ? 'as' : 'os' };
}
