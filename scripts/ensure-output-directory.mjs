import { mkdir } from "node:fs/promises";

const directories = process.argv.slice(2);
if (directories.length === 0) throw new Error("At least one output directory is required.");

await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
