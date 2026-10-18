/**
 * The noun a model uses for what it compares.
 *
 * It is written into the create flow's central question, so getting it wrong is
 * not cosmetic: a model about webservice latency asking "qual das duas propostas
 * escolhe?" is asking about something that is not in the model. What these tests
 * pin is that the noun travels, and that the article agrees with it — "o
 * proposta" would be worse than the problem it fixes.
 */
import { describe, it, expect } from 'vitest';
import { subjectNoun, subjectWords, SUBJECT_PRESETS } from '../../domain/subject';

describe('subjectNoun', () => {
  it('defaults to "proposta" for a model that never chose', () => {
    expect(subjectNoun({})).toMatchObject({ one: 'proposta', many: 'propostas', art: 'a' });
  });

  it('keeps the wording of models saved before the field existed', () => {
    expect(subjectNoun({ subjectKind: 'positions' }).one).toBe('posição');
  });

  it('uses what the model chose, capitalised forms included', () => {
    const n = subjectNoun({ subject: { one: 'serviço', many: 'serviços' } });
    expect(n).toMatchObject({ one: 'serviço', many: 'serviços', One: 'Serviço', Many: 'Serviços' });
  });

  it('agrees the article with the noun, for presets and for typed words', () => {
    expect(subjectNoun({ subject: { one: 'serviço', many: 'serviços' } })).toMatchObject({ art: 'o', artMany: 'os' });
    expect(subjectNoun({ subject: { one: 'alternativa', many: 'alternativas' } })).toMatchObject({ art: 'a', artMany: 'as' });
    // Typed, not a preset: the guess has to carry the common endings.
    expect(subjectNoun({ subject: { one: 'integração', many: 'integrações' } }).art).toBe('a');
    expect(subjectNoun({ subject: { one: 'endpoint', many: 'endpoints' } }).art).toBe('o');
  });

  it('ignores a half-filled choice rather than printing an empty noun', () => {
    expect(subjectNoun({ subject: { one: 'serviço', many: '  ' } }).one).toBe('proposta');
  });

  it('every preset declares a plural and keeps its own gender', () => {
    for (const p of SUBJECT_PRESETS) {
      expect(p.many.length).toBeGreaterThan(p.one.length - 2);
      expect(subjectWords({ subject: { one: p.one, many: p.many } }).f).toBe(p.f ?? false);
    }
  });
});
