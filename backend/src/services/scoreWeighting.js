/**
 * Adaptive weighted score — renormalizes when live API factors are unavailable.
 */

const DEFAULT_WEIGHTS = {
  aqi: 0.25,
  weather: 0.2,
  crowdDensity: 0.2,
  hygiene: 0.2,
  historical: 0.15,
};

/**
 * @param {Record<string, { value: number|null, available: boolean, weight?: number }>} factors
 * @returns {{ score: number|null, weightsUsed: Record<string, number> }}
 */
export function computeAdaptiveScore(factors) {
  let weightedSum = 0;
  let totalWeight = 0;
  const weightsUsed = {};

  for (const [key, factor] of Object.entries(factors)) {
    const w = factor.weight ?? DEFAULT_WEIGHTS[key] ?? 0;
    if (!factor.available || factor.value == null || Number.isNaN(factor.value)) continue;
    weightedSum += factor.value * w;
    totalWeight += w;
    weightsUsed[key] = w;
  }

  if (totalWeight === 0) {
    return { score: null, weightsUsed: {} };
  }

  const score = Math.round(weightedSum / totalWeight);
  return { score: Math.max(0, Math.min(100, score)), weightsUsed };
}

export default { computeAdaptiveScore, DEFAULT_WEIGHTS };
