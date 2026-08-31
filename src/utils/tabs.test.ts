import { expect, test } from "vitest";
import { getTabFile, getTabGameNumber, isPersistentGameOrigin, type Tab } from "./tabs";

const fileTab = {
    value: "tab-1",
    name: "games.pgn",
    type: "analysis",
    gameOrigin: {
        kind: "file",
        gameNumber: 2,
        file: { name: "games.pgn", numGames: 4 },
    },
} as Tab;

test("getTabFile returns the file metadata only for file-backed tabs", () => {
    expect(getTabFile(undefined)).toBeUndefined();
    expect(getTabFile(fileTab)?.name).toBe("games.pgn");
    expect(getTabFile({ ...fileTab, gameOrigin: { kind: "none" } } as Tab)).toBeUndefined();
});

test("getTabGameNumber and persistence follow the game origin kind", () => {
    expect(getTabGameNumber(undefined)).toBe(0);
    expect(getTabGameNumber(fileTab)).toBe(2);
    expect(isPersistentGameOrigin(undefined)).toBe(false);
    expect(isPersistentGameOrigin(fileTab)).toBe(true);
    expect(isPersistentGameOrigin({ ...fileTab, gameOrigin: { kind: "none" } } as Tab)).toBe(false);
});
