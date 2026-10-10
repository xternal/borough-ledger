import { buildModel } from "@/lib/model";
import { OG_SIZE } from "@/lib/ogCollection";
import { optionsImage } from "@/lib/ogOptions";

export const alt = "What the council's three council tax options for next year would add to a Band D bill in Hammersmith & Fulham, on Borough Book";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return optionsImage(buildModel(), "D");
}
