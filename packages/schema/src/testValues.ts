import { provenanceRefs, type Dataset } from "./data";

/** Every value or card in the dataset that is test data, by path. */
export function listTestValues(d: Dataset): string[] {
  const values = provenanceRefs(d)
    .filter((r) => r.quality === "test")
    .map((r) => r.path);
  const costs = d.content.promises.flatMap((p) =>
    (["cost_m", "capital_cost_m"] as const).filter((k) => p[k]?.quality === "test").map((k) => `promises.${p.id}.${k}`),
  );
  return [...values, ...costs];
}
