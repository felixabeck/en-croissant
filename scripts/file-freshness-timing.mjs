export function fileFreshnessTiming(
  { readFinishedAt, appliedAt, observedAt, lexAwaitMs, readTimeMs },
  pollIntervalMs,
) {
  const applicationMs = [appliedAt, readFinishedAt, lexAwaitMs].every(Number.isFinite)
    ? appliedAt - readFinishedAt - lexAwaitMs
    : Number.NaN;
  const observationGapMs = [observedAt, appliedAt].every(Number.isFinite)
    ? observedAt - appliedAt
    : Number.NaN;
  const mainThreadMs = [observedAt, readFinishedAt, lexAwaitMs].every(Number.isFinite)
    ? observedAt - readFinishedAt - lexAwaitMs
    : Number.NaN;
  const deadlineMs = [pollIntervalMs, readTimeMs, lexAwaitMs, mainThreadMs].every(Number.isFinite)
    ? pollIntervalMs + readTimeMs + lexAwaitMs + mainThreadMs
    : Number.NaN;
  return { applicationMs, observationGapMs, mainThreadMs, deadlineMs };
}

export function fileFreshnessApplicationWithinBudget({ applicationMs }, budgetMs) {
  return Number.isFinite(applicationMs) && applicationMs >= 0 && applicationMs <= budgetMs;
}

export function fileFreshnessMainThreadWithinBudget({ mainThreadMs }, budgetMs) {
  return Number.isFinite(mainThreadMs) && mainThreadMs >= 0 && mainThreadMs <= budgetMs;
}
