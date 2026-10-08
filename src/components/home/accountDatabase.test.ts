import { expect, test } from "vitest";
import { accountDatabaseFilename } from "./accountDatabase";

test.each(["lichess", "chesscom"] as const)("identifies the %s account database", (type) => {
    expect(accountDatabaseFilename("Magnus", type)).toBe(`Magnus_${type}.db3`);
});
