export function hasBinary(name: string): boolean {
  return Bun.which(name) !== null;
}
