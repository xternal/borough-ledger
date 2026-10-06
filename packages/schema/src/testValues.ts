import { provenanceRefs, type Dataset } from "./data";

/** Every value or card in the dataset that is test data, by path. */
export function listTestValues(d: Dataset): string[] {
  const values = provenanceRefs(d)
    .filter((r) => r.quality === "test")
    .map((r) => r.path);
  const cards = d.promises.promises.filter((p) => p.test).map((p) => `promises.${p.id} (test card)`);
  return [...values, ...cards];
}
