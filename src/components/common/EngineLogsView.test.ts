import { expect, test } from "vitest";
import { truncatedLogCount } from "./EngineLogsView";

test("counts only explicit engine-log truncation metadata", () => {
    expect(
        truncatedLogCount([
            { type: "gui", value: "started" },
            { type: "engine", value: "info depth 16" },
            { type: "truncated", value: { droppedEntries: 3n } },
            { type: "truncated", value: { droppedEntries: 4n } },
        ]),
    ).toBe(7);
});

test("reports no truncation metadata when every entry is a real log line", () => {
    expect(truncatedLogCount([{ type: "engine", value: "readyok" }])).toBe(0);
});
