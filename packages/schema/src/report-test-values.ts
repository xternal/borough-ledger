/* Lists every test value in the seed. Run: pnpm --filter @borough-ledger/schema report:test-values */
import { DATA } from "./data";
import { listTestValues } from "./testValues";

const list = listTestValues(DATA);
console.log(`${list.length} test values or cards in the dataset:`);
for (const p of list) console.log(`  ${p}`);
