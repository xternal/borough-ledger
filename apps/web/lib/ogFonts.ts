/* Fonts for share images. Kept in assets/fonts (SIL Open Font License) and listed in next.config's
   outputFileTracingIncludes, so images rendered on request on Vercel can read them: a path through
   node_modules/geist is a pnpm link that does not exist on Vercel's servers. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function ogFonts() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [regular, semibold] = await Promise.all([readFile(join(dir, "Geist-Regular.ttf")), readFile(join(dir, "Geist-SemiBold.ttf"))]);
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}
