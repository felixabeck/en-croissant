import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function playwrightImage() {
  const { version } = require("@playwright/test/package.json");
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}
