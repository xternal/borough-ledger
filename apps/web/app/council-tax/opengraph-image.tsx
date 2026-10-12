import { OG_SIZE } from "@/lib/ogCollection";
import { decoderImage } from "@/lib/ogDecoder";

export const alt = "Your council tax, decoded: how much your council keeps of a Band D bill, and how much goes to the county or the Mayor, police, fire and parish councils, for every council in England, on BoroughBook.UK";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return decoderImage();
}
