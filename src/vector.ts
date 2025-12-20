export type Vector = number[];

export const add = (a: Vector, b: Vector): Vector =>
  a.map((val, i) => val + b[i]);

export const subtract = (a: Vector, b: Vector): Vector =>
  a.map((val, i) => val - b[i]);

export const scale = (v: Vector, scalar: number): Vector =>
  v.map((val) => val * scalar);

export const dot = (a: Vector, b: Vector): number =>
  a.reduce((sum, val, i) => sum + val * b[i], 0);

export const magnitude = (v: Vector): number => Math.sqrt(dot(v, v));

export const normalize = (v: Vector): Vector => {
  const mag = magnitude(v);
  return mag === 0 ? v : scale(v, 1 / mag);
};

export const zero = (dimensions: number): Vector =>
  new Array(dimensions).fill(0);

export const lerp = (a: Vector, b: Vector, t: number): Vector =>
  a.map((val, i) => val + t * (b[i] - val));

export const mean = (vectors: Vector[]): Vector => {
  if (vectors.length === 0) {
    throw new Error("Cannot compute mean of empty array");
  }
  const sum = vectors.reduce((acc, v) => add(acc, v), zero(vectors[0].length));
  return scale(sum, 1 / vectors.length);
};
