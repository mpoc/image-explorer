import base64
import io
import json
from pathlib import Path
from fastapi import FastAPI, Header
from pydantic import BaseModel
from transformers import AutoProcessor, CLIPModel, infer_device, pipeline
from transformers.image_utils import load_image
from PIL import Image
import requests
import torch

app = FastAPI()

device = infer_device()
print(f"Using device: {device}")

config_path = Path(__file__).parent.parent / "src" / "config.json"
with open(config_path, 'r') as f:
    config = json.load(f)
    model_name = config['modelName']

print(f"Loading model: {model_name}")
model = CLIPModel.from_pretrained(model_name).to(device)
processor = AutoProcessor.from_pretrained(model_name, use_fast=True)

class EmbedRequest(BaseModel):
    image: str

class TextEmbedRequest(BaseModel):
    text: str

@app.post("/embed")
def embed(req: EmbedRequest, authorization: str = Header(None)):
    if req.image.startswith("http"):
        headers = {"Authorization": authorization} if authorization else {}
        response = requests.get(req.image, headers=headers)
        img = Image.open(io.BytesIO(response.content))
    else:
        img = Image.open(io.BytesIO(base64.b64decode(req.image)))

    print(f"Image format: {img.format}, size: {img.size}, mode: {img.mode}")

    inputs = processor(images=img, return_tensors="pt").to(device)

    with torch.inference_mode():
        image_features = model.get_image_features(**inputs)

    embedding = image_features[0].cpu().tolist()

    print(f"Generated embedding of length {len(embedding)}")
    return {"embedding": embedding}

@app.post("/embed_text")
def embed_text(req: TextEmbedRequest):
    print(f"Processing text: {req.text[:100]}{'...' if len(req.text) > 100 else ''}")

    inputs = processor(text=req.text, return_tensors="pt", padding=True).to(device)

    with torch.inference_mode():
        text_features = model.get_text_features(**inputs)

    embedding = text_features[0].cpu().tolist()
    print(f"Generated embedding of length {len(embedding)}")
    return {"embedding": embedding}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
