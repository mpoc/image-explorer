import config from "./config.json";

export const MODEL_NAME = config.modelName;
export const CANONICAL_MODEL_NAME =
  config.canonicalModelName ?? config.modelName;
console.log(
  `Using ${MODEL_NAME} model` +
    (MODEL_NAME === CANONICAL_MODEL_NAME
      ? " (canonical)"
      : ` (canonical: ${CANONICAL_MODEL_NAME})`)
);
