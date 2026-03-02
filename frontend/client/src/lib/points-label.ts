export function getPointsWord(count: number, language: string): string {
  const lang = (language || "").toLowerCase();
  if (lang.startsWith("ru")) {
    const n = Math.abs(Number(count));
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return "баллов";
    if (mod10 === 1) return "балл";
    if (mod10 >= 2 && mod10 <= 4) return "балла";
    return "баллов";
  }
  return Number(count) === 1 ? "point" : "points";
}

export function formatPoints(count: number, language: string): string {
  const word = getPointsWord(count, language);
  return `${count} ${word}`;
}

export function formatScoreRange(score: number, max: number, language: string): string {
  const lang = (language || "").toLowerCase();
  const scoreWord = getPointsWord(score, language);
  const maxWord = getPointsWord(max, language);
  if (lang.startsWith("ru")) {
    return `${score} ${scoreWord} из ${max} ${maxWord}`;
  }
  return `${score} of ${max} ${maxWord}`;
}
