import torch
import timm
from PIL import Image
from timm.data import resolve_data_config, create_transform

CHECKPOINT = "/home/ec2-user/fold4_best.pth"
IMG = "/tmp/real.jpg"

print("Loading model...")
model = timm.create_model("swin_small_patch4_window7_224", pretrained=False, num_classes=1)
state_dict = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
if isinstance(state_dict, dict):
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    model.load_state_dict(state_dict, strict=False)
model.eval()
print("Model loaded OK")

transform = create_transform(**resolve_data_config({}, model=model))
tensor = transform(Image.open(IMG).convert("RGB")).unsqueeze(0)

with torch.no_grad():
    prob = torch.sigmoid(model(tensor)).item()

print("=" * 40)
print(f"Deepfake probability : {prob:.4f}")
print(f"Verdict              : {'FAKE' if prob > 0.5 else 'REAL'}")
print(f"Confidence           : {abs(prob-0.5)*200:.1f}%")
print("=" * 40)
