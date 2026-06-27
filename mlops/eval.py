import torch
import timm
import os
import time
import json
from PIL import Image
from timm.data import resolve_data_config, create_transform

CHECKPOINT = "/home/ec2-user/fold4_best.pth"
REAL_DIR = "/tmp/eval/real"
FAKE_DIR = "/tmp/eval/fake"

print("Loading model...")
model = timm.create_model("swin_small_patch4_window7_224", pretrained=False, num_classes=1)
state_dict = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
if isinstance(state_dict, dict):
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    model.load_state_dict(state_dict, strict=False)
model.eval()
print("Model loaded OK")

transform = create_transform(**resolve_data_config({}, model=model))

results = []
for label, d in [("REAL", REAL_DIR), ("FAKE", FAKE_DIR)]:
    if not os.path.isdir(d):
        continue
    files = [f for f in sorted(os.listdir(d)) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    print(f"\nScoring {label} ({len(files)} images)...")
    for f in files:
        path = os.path.join(d, f)
        try:
            t = time.time()
            img = Image.open(path).convert("RGB")
            tensor = transform(img).unsqueeze(0)
            with torch.no_grad():
                prob = torch.sigmoid(model(tensor)).item()
            ms = (time.time() - t) * 1000
            verdict = "FAKE" if prob > 0.5 else "REAL"
            ok = verdict == label
            results.append({"file": f, "label": label, "prob": round(prob, 4), "verdict": verdict, "correct": ok, "ms": round(ms)})
            print(f"  {f}: {prob:.4f} -> {verdict} {'OK' if ok else 'WRONG'} ({ms:.0f}ms)")
        except Exception as e:
            print(f"  {f}: ERROR - {e}")

if not results:
    print("No images scored.")
else:
    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    lats = sorted(r["ms"] for r in results)
    real_r = [r for r in results if r["label"] == "REAL"]
    fake_r = [r for r in results if r["label"] == "FAKE"]

    print("\n" + "=" * 50)
    print("GOTHAM AI-01 EVALUATION REPORT")
    print("=" * 50)
    print(f"Total images     : {total}")
    print(f"Overall accuracy : {correct / total * 100:.1f}%")
    if real_r:
        tnr = sum(1 for r in real_r if r["correct"]) / len(real_r)
        print(f"TNR (real->real) : {tnr * 100:.1f}%  ({sum(1 for r in real_r if r['correct'])}/{len(real_r)})")
    if fake_r:
        tpr = sum(1 for r in fake_r if r["correct"]) / len(fake_r)
        print(f"TPR (fake->fake) : {tpr * 100:.1f}%  ({sum(1 for r in fake_r if r['correct'])}/{len(fake_r)})")
    print(f"Latency p50      : {lats[len(lats) // 2]:.0f}ms")
    print(f"Latency p95      : {lats[min(int(len(lats) * 0.95), len(lats) - 1)]:.0f}ms")
    print(f"Latency p99      : {lats[min(int(len(lats) * 0.99), len(lats) - 1)]:.0f}ms")
    print("=" * 50)
    json.dump(results, open("/tmp/eval_results.json", "w"), indent=2)
    print("Results saved to /tmp/eval_results.json")
