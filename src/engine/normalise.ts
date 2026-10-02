export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
