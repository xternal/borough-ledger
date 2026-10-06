"""Inject seed JSON into the prototype template -> prototype/index.html"""
import json, pathlib
root = pathlib.Path(__file__).parent
t = (root/"prototype/template.html").read_text()
for key, f in [("HF","hf_2026-27.json"),("PROM","promises.json"),("PAY","payments.json")]:
    data = json.dumps(json.loads((root/"data/seed"/f).read_text()), ensure_ascii=False)
    t = t.replace(f"/*__{key}__*/null", data)
assert "/*__" not in t
(root/"prototype/index.html").write_text(t)
print("ok", len(t))
