import { readFileSync } from "node:fs";
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";
import { setupGlobals } from "bun-webgpu";
import { MODEL_NAME } from "./config";

setupGlobals();

const loadModel = (() => {
  console.log(`Loading model: ${MODEL_NAME}`);
  const device = navigator.gpu ? "webgpu" : "cpu";
  console.log(`Using device: ${device}`);

  const promise = Promise.all([
    CLIPTextModelWithProjection.from_pretrained(MODEL_NAME, { device }),
    CLIPVisionModelWithProjection.from_pretrained(MODEL_NAME, { device }),
    AutoProcessor.from_pretrained(MODEL_NAME),
    AutoTokenizer.from_pretrained(MODEL_NAME),
  ] as const).then((result) => {
    console.log("Model loaded");
    return result;
  });

  return () => promise;
})();

export const computeTextEmbedding = async (text: string) => {
  const [textModel, , , tokenizer] = await loadModel();

  const inputs = tokenizer(text, { padding: true, truncation: true });
  const { text_embeds } = await textModel(inputs);
  return text_embeds.tolist()[0] as number[];
};

export const computeImageEmbedding = async (imagePath: string) => {
  const [, visionModel, processor] = await loadModel();

  const url = new URL(imagePath);
  let image: RawImage;

  if (url.protocol === "file:") {
    const buffer = readFileSync(url);
    image = await RawImage.fromBlob(new Blob([buffer]));
  } else {
    const response = await fetch(imagePath, {
      headers: process.env.AUTHORIZATION
        ? { Authorization: process.env.AUTHORIZATION }
        : {},
    });
    const blob = await response.blob();
    image = await RawImage.fromBlob(blob);
  }

  const inputs = await processor(image);
  const { image_embeds } = await visionModel(inputs);
  return image_embeds.tolist()[0] as number[];
};
