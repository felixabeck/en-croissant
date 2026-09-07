export function parseRustHostMetadata(metadata) {
  return /^host: ([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+)\r?$/m.exec(metadata)?.[1];
}
