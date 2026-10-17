/** "Parks, libraries and leisure" -> "parks-libraries-and-leisure". Imports nothing, so pages in the browser can use it. */
export const topicSlug = (area: string) =>
  area
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
