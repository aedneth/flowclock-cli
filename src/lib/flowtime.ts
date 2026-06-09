/**
 * Flowtime proportional-break engine.
 *
 * Maps focus duration → recommended break duration using the Flowtime technique
 * bands: short focus earns a fixed break; longer focus earns proportionally more.
 */

/** Lower/upper bound of the recommended break range for a given focus duration. */
export interface BreakBand {
  minS: number;
  maxS: number;
}

/**
 * Return the recommended break band for a given focus duration in seconds.
 *
 * Bands (focus → break range):
 *   < 25 min  → {300, 300}   (5 min flat)
 *   25–49 min → {480, 600}   (8–10 min)
 *   50–89 min → {600, 900}   (10–15 min)
 *   ≥ 90 min  → {900, 1800}  (15–30 min)
 */
export function breakBand(focusS: number): BreakBand {
  const focusMin = focusS / 60;
  if (focusMin < 25) return { minS: 300, maxS: 300 };
  if (focusMin < 50) return { minS: 480, maxS: 600 };
  if (focusMin < 90) return { minS: 600, maxS: 900 };
  return { minS: 900, maxS: 1800 };
}

/**
 * Return the midpoint of the break band for a given focus duration, in whole seconds.
 */
export function suggestBreakS(focusS: number): number {
  const band = breakBand(focusS);
  return Math.round((band.minS + band.maxS) / 2);
}

/**
 * Return the ratio of break time to focus time.
 * Returns 0 if focusS is 0 or negative.
 */
export function breakRatio(focusS: number, breakS: number): number {
  if (focusS <= 0) return 0;
  return breakS / focusS;
}
