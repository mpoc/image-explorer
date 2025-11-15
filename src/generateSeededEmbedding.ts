// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49_297) % 233_280;
    return this.seed / 233_280;
  }

  nextInt(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Generate a deterministic "random" embedding based on seed
export const generateSeededEmbedding = (seed: number): number[] => {
  const rng = new SeededRandom(seed);
  const embedding = new Array(512);

  // Generate normalized random vector
  let sumSquares = 0;
  for (let i = 0; i < 512; i++) {
    embedding[i] = rng.next() * 2 - 1; // Range [-1, 1]
    sumSquares += embedding[i] * embedding[i];
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(sumSquares);
  for (let i = 0; i < 512; i++) {
    embedding[i] /= magnitude;
  }

  return embedding;
};
