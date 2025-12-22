import assert from "node:assert/strict";
import { add, mean, normalize, subtract, type Vector, zero } from "./vector";

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

export const extrapolators = {
  last: new LastPathExtrapolator(),
  momentum: new MomentumPathExtrapolator(0.6),
  centroid: new CentroidPathExtrapolator(),
} as const;

export type ExtrapolatorName = keyof typeof extrapolators;

export const getExtrapolator = (name: ExtrapolatorName): PathExtrapolator =>
  extrapolators[name];

export const DEFAULT_EXTRAPOLATOR: ExtrapolatorName = "momentum";
