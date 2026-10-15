import { loadJson, saveJson } from '../core/storage';

export interface ScoreEntry {
  score: number;
  stage: number;
  kills: number;
  date: string; // ISO date (yyyy-mm-dd)
}

const KEY = 'highscores.v1';
const MAX = 10;

export function loadHighScores(): ScoreEntry[] {
  const list = loadJson<ScoreEntry[]>(KEY, []);
  return Array.isArray(list) ? list.slice(0, MAX) : [];
}

/** Insert a run; returns its 0-based rank, or -1 if it didn't make the table. */
export function submitScore(entry: ScoreEntry): number {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(entry);
  saveJson(KEY, list.slice(0, MAX));
  return rank < MAX ? rank : -1;
}
