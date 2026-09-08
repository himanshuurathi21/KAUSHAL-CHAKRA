/**
 * Unit tests for skill verification grading (quiz) + quiz bank shape.
 * Pure logic — no DB.
 */
import { describe, it, expect } from 'vitest';
import { getQuiz, hasQuiz, quizSkillNames } from '../src/services/quizBank.js';
import {
  gradeQuiz,
  levelForScore,
  passesClaim,
  publicQuestions,
  PASS_THRESHOLD,
} from '../src/services/verificationService.js';

const sample = [
  { q: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0, level: 'BEGINNER' },
  { q: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 2, level: 'INTERMEDIATE' },
  { q: 'Q3', options: ['a', 'b', 'c', 'd'], answer: 1, level: 'EXPERT' },
  { q: 'Q4', options: ['a', 'b', 'c', 'd'], answer: 3, level: 'EXPERT' },
];

describe('gradeQuiz', () => {
  it('counts exact option-index matches', () => {
    expect(gradeQuiz(sample, [0, 2, 1, 3])).toEqual({ score: 4, total: 4 });
    expect(gradeQuiz(sample, [1, 2, 0, 3])).toEqual({ score: 2, total: 4 });
    expect(gradeQuiz(sample, [1, 1, 1, 1])).toEqual({ score: 1, total: 4 });
  });

  it('ignores extra answers and missing answers', () => {
    expect(gradeQuiz(sample, [0, 2, 1, 3, 0, 0])).toEqual({ score: 4, total: 4 });
    expect(gradeQuiz(sample, [0])).toEqual({ score: 1, total: 4 });
    expect(gradeQuiz(sample, [])).toEqual({ score: 0, total: 4 });
  });

  it('rejects non-array answers', () => {
    expect(() => gradeQuiz(sample, null)).toThrow();
    expect(() => gradeQuiz(sample, 'abc')).toThrow();
  });
});

describe('levelForScore / passesClaim', () => {
  it('maps ratio to the highest cleared level', () => {
    expect(levelForScore(1)).toBe('EXPERT');
    expect(levelForScore(PASS_THRESHOLD.EXPERT)).toBe('EXPERT');
    expect(levelForScore(PASS_THRESHOLD.INTERMEDIATE)).toBe('INTERMEDIATE');
    expect(levelForScore(PASS_THRESHOLD.BEGINNER)).toBe('BEGINNER');
    expect(levelForScore(PASS_THRESHOLD.BEGINNER - 0.01)).toBe(null);
    expect(levelForScore(0)).toBe(null);
  });

  it('passes a claim only at/above its threshold', () => {
    expect(passesClaim(0.9, 'EXPERT')).toBe(true);
    expect(passesClaim(0.7, 'EXPERT')).toBe(false);
    expect(passesClaim(0.7, 'INTERMEDIATE')).toBe(true);
    expect(passesClaim(0.5, 'INTERMEDIATE')).toBe(false);
    expect(passesClaim(0.5, 'BEGINNER')).toBe(true);
    expect(passesClaim(0.1, 'BEGINNER')).toBe(false);
  });

  it('rejects unknown levels', () => {
    expect(() => passesClaim(1, 'MASTER')).toThrow();
  });
});

describe('publicQuestions', () => {
  it('strips answers before sending to the client', () => {
    const pub = publicQuestions(sample);
    expect(pub).toHaveLength(4);
    for (const q of pub) {
      expect(q).not.toHaveProperty('answer');
      expect(q.options).toHaveLength(4);
    }
  });
});

describe('quizBank', () => {
  it('covers the key demo skills', () => {
    for (const name of ['Python', 'Guitar', 'Photography', 'Piano', 'Spanish', 'Cooking']) {
      expect(hasQuiz(name)).toBe(true);
    }
  });

  it('returns well-formed questions with exactly one valid answer', () => {
    for (const name of quizSkillNames()) {
      const questions = getQuiz(name);
      expect(questions.length).toBeGreaterThanOrEqual(5);
      const levels = new Set(questions.map((q) => q.level));
      expect(levels.has('BEGINNER')).toBe(true);
      expect(levels.has('EXPERT')).toBe(true);
      for (const q of questions) {
        expect(typeof q.q).toBe('string');
        expect(q.options).toHaveLength(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
        expect(['BEGINNER', 'INTERMEDIATE', 'EXPERT']).toContain(q.level);
      }
    }
  });

  it('returns null for skills without a bank', () => {
    expect(getQuiz('Origami')).toBe(null);
    expect(hasQuiz('Origami')).toBe(false);
  });
});
