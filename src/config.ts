import config from "./config.json";

export const MODEL_NAME = config.modelName;
console.log("Using", MODEL_NAME, "model");

export const EMBEDDING_API_BASE_URL = "http://localhost:8000";
