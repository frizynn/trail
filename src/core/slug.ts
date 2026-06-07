const MAX_WORDS = 6;

/** Convert a free-form title into a kebab-case, accent-free slug of at most 6 words. */
export function slugify(title: string): string {
  const normalized = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const words = normalized
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.slice(0, MAX_WORDS).join("-");
}
