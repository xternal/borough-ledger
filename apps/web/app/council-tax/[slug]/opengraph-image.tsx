import { decodedCouncil, decodedCouncils } from "@/lib/decoder";
import { OG_SIZE } from "@/lib/ogCollection";
import { decodedImage } from "@/lib/ogDecoder";

export const alt = "Where a Band D council tax bill goes in one English council: the total, the change on last year, and how much the council, the county or the Mayor, police, fire and parish councils each get, on BoroughBook.UK";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return decodedCouncils().map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return decodedImage(decodedCouncil((await params).slug)!);
}
