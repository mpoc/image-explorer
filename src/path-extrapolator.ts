import assert from "node:assert/strict";
import {
  add,
  dot,
  mean,
  normalize,
  scale,
  subtract,
  sum,
  type Vector,
  zero,
} from "./vector";

/**
 * Interface for path extrapolation strategies.
 * Given a sequence of embeddings representing an exploration path,
 * compute a target embedding to search for similar images.
 */
export type PathExtrapolator = {
  readonly name: string;
  extrapolate(path: Vector[]): Vector;
};

/**
 * Returns the last embedding in the path.
 * This is the baseline behavior - no extrapolation.
 */
export class LastPathExtrapolator implements PathExtrapolator {
  readonly name = "last";

  extrapolate(path: Vector[]): Vector {
    if (path.length === 0) {
      throw new Error("Path cannot be empty");
    }
    const last = path.at(-1);
    assert(last);
    return last;
  }
}

/**
 * Extrapolates using Exponential Moving Average of velocity vectors.
 *
 * The velocity EMA automatically encodes:
 * - Direction: where the exploration is heading
 * - Speed: how large the steps are
 * - Convergence/divergence: adapts extrapolation magnitude based on step sizes
 *
 * @param alpha - Decay factor in (0, 1). Higher values weight recent steps more.
 *                Default 0.6 provides balanced smoothing.
 */
export class MomentumPathExtrapolator implements PathExtrapolator {
  readonly name = "momentum";
  readonly alpha: number;

  constructor(alpha = 0.6) {
    if (alpha <= 0 || alpha >= 1) {
      throw new Error("Alpha must be in (0, 1)");
    }
    this.alpha = alpha;
  }

  extrapolate(path: Vector[]): Vector {
    if (path.length === 0) {
      throw new Error("Path cannot be empty");
    }

    // Single point: no velocity information
    if (path.length === 1) {
      return path[0];
    }

    const velocityEma = this.computeVelocityEma(path);
    const lastPosition = path.at(-1);
    assert(lastPosition);
    const extrapolated = add(lastPosition, velocityEma);

    // Renormalize to stay on the unit hypersphere
    return normalize(extrapolated);
  }

  private computeVelocityEma(path: Vector[]): Vector {
    const dimensions = path[0].length;
    let ema = zero(dimensions);

    for (let i = 1; i < path.length; i++) {
      const velocity = subtract(path[i], path[i - 1]);

      if (i === 1) {
        ema = velocity;
      } else {
        // EMA update: α * current + (1 - α) * previous
        ema = ema.map(
          (val, d) => this.alpha * velocity[d] + (1 - this.alpha) * val
        );
      }
    }

    return ema;
  }
}

/**
 * Extrapolates by computing the centroid (mean) of all path embeddings.
 * Useful for finding content similar to the overall exploration theme.
 */
export class CentroidPathExtrapolator implements PathExtrapolator {
  readonly name = "centroid";

  extrapolate(path: Vector[]): Vector {
    if (path.length === 0) {
      throw new Error("Path cannot be empty");
    }

    return normalize(mean(path));
  }
}

/**
 * Extrapolates along the principal axis of the path.
 * PCA finds the direction of most variance (the "long axis" of the explored region)
 * and extrapolates from the centroid along this axis.
 *
 * The projection direction is determined by a weighted combination of the last N points,
 * with more recent points weighted higher (exponential decay).
 */
export class PCAPathExtrapolator implements PathExtrapolator {
  readonly name = "pca";
  readonly extrapolationFactor: number;
  readonly projectionWindow: number;
  readonly decayFactor: number;

  /**
   * @param extrapolationFactor Controls how far to extrapolate along the principal axis.
   *   - 1.0 = land at the weighted projection point
   *   - >1.0 = overshoot (more exploratory)
   *   - <1.0 = undershoot (more conservative)
   * @param projectionWindow Number of recent points to use for direction.
   *   - 1 = only last point (original behavior)
   *   - >1 = blend recent points with exponential decay weighting
   * @param decayFactor Weight decay for older points in window (0, 1).
   *   Higher = older points retain more influence.
   */
  constructor(
    extrapolationFactor = 1.5,
    projectionWindow = 1,
    decayFactor = 0.6
  ) {
    if (projectionWindow < 1) {
      throw new Error("projectionWindow must be at least 1");
    }
    if (decayFactor <= 0 || decayFactor >= 1) {
      throw new Error("decayFactor must be in (0, 1)");
    }
    this.extrapolationFactor = extrapolationFactor;
    this.projectionWindow = projectionWindow;
    this.decayFactor = decayFactor;
  }

  extrapolate(path: Vector[]): Vector {
    if (path.length === 0) {
      throw new Error("Path cannot be empty");
    }
    if (path.length < 3) {
      return normalize(mean(path));
    }

    const centroid = mean(path);
    const centered = path.map((p) => subtract(p, centroid));

    // Principal axis: direction of maximum variance across all points
    const principalAxis = this.powerIteration(centered);

    // Weighted projection: recent points influence direction more heavily
    const projection = this.computeWeightedProjection(centered, principalAxis);

    const target = add(
      centroid,
      scale(principalAxis, projection * this.extrapolationFactor)
    );

    return normalize(target);
  }

  /**
   * Computes projection onto principal axis using exponentially-weighted
   * average of the last N points. Recent points get higher weight:
   *   weight(i) = decayFactor^(distance from end)
   *
   * Example with window=3, decay=0.6:
   *   last:        weight = 0.6^0 = 1.0
   *   second-last: weight = 0.6^1 = 0.6
   *   third-last:  weight = 0.6^2 = 0.36
   */
  private computeWeightedProjection(
    centered: Vector[],
    principalAxis: Vector
  ): number {
    const windowSize = Math.min(this.projectionWindow, centered.length);
    const windowStart = centered.length - windowSize;

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < windowSize; i++) {
      const distanceFromEnd = windowSize - 1 - i;
      const weight = this.decayFactor ** distanceFromEnd;

      const proj = dot(centered[windowStart + i], principalAxis);
      weightedSum += weight * proj;
      totalWeight += weight;
    }

    return weightedSum / totalWeight;
  }

  private powerIteration(centered: Vector[], iterations = 50): Vector {
    let v = normalize(centered[0]);

    for (let i = 0; i < iterations; i++) {
      const Cv = sum(centered.map((x) => scale(x, dot(x, v))));
      v = normalize(Cv);
    }

    return v;
  }
}

export const extrapolators = {
  last: new LastPathExtrapolator(),
  momentum: new MomentumPathExtrapolator(0.6),
  centroid: new CentroidPathExtrapolator(),
  pca: new PCAPathExtrapolator(1.5, 15, 0.8),
} as const;

export type ExtrapolatorName = keyof typeof extrapolators;

export const getExtrapolator = (name: ExtrapolatorName): PathExtrapolator =>
  extrapolators[name];

export const DEFAULT_EXTRAPOLATOR: ExtrapolatorName = "pca";
