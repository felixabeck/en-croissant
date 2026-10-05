import { createStore } from "jotai";
import { INITIAL_FEN } from "chessops/fen";
import { expect, test } from "vitest";
import type { BestMoves } from "@/bindings";
import { analysisSearch } from "@/components/panels/analysis/analysisSearch";
import { AnalysisLineMemory } from "@/components/panels/analysis/analysisLineMemory";
import {
    activeTabAtom,
    bestMovesFamily,
    currentThreatAtom,
    disposeTabAtoms,
    engineMovesFamily,
    enginesAtom,
    firstEngineWithLinesFamily,
    tabsAtom,
} from "./atoms";

const engine = {
    type: "local" as const,
    id: "normal-engine",
    name: "Same name",
    version: "17",
    filename: "stockfish",
    handle: { id: { id: "same-handle" }, kind: "engine" as const },
    loaded: true,
};
const lines = (uci: string): BestMoves[] => [
    {
        depth: 20,
        multipv: 1,
        score: { value: { type: "cp", value: 10 }, wdl: null },
        nodes: 1n,
        nps: 1n,
        uciMoves: [uci],
        sanMoves: [],
    },
];

test("both atoms select only the current mode with coexisting normal and threat entries", async () => {
    const store = createStore();
    const tab = "analysis-mode-selection";
    store.set(tabsAtom, [
        { value: tab, name: "Analysis", type: "analysis", gameOrigin: { kind: "none" } },
    ]);
    store.set(activeTabAtom, tab);
    const threatEngine = { ...engine, id: "threat-engine" };
    await store.set(enginesAtom, [engine, threatEngine]);
    const normal = analysisSearch(INITIAL_FEN, ["e2e4"], false).key;
    const threat = analysisSearch(INITIAL_FEN, ["e2e4"], true).key;
    store.set(
        engineMovesFamily({ tab, engine: engine.id }),
        new AnalysisLineMemory(new Map([[normal, lines("e7e5")]])),
    );
    store.set(
        engineMovesFamily({ tab, engine: threatEngine.id }),
        new AnalysisLineMemory(new Map([[threat, lines("d2d4")]])),
    );
    const position = { fen: INITIAL_FEN, gameMoves: ["e2e4"] };
    store.set(currentThreatAtom, false);
    expect(store.get(firstEngineWithLinesFamily(position))).toBe(engine.id);
    expect([...store.get(bestMovesFamily(position))]).toEqual([
        [0, [{ pv: ["e7e5"], winChance: expect.any(Number) }]],
    ]);
    store.set(currentThreatAtom, true);
    expect(store.get(firstEngineWithLinesFamily(position))).toBe(threatEngine.id);
    expect([...store.get(bestMovesFamily(position))]).toEqual([
        [1, [{ pv: ["d2d4"], winChance: expect.any(Number) }]],
    ]);
    store.set(currentThreatAtom, false);
    expect(store.get(firstEngineWithLinesFamily(position))).toBe(engine.id);
    expect(store.get(bestMovesFamily(position)).get(0)?.[0].pv).toEqual(["e7e5"]);
    disposeTabAtoms(tab);
});

test("threat at A, navigate away, threat off, return to A exposes no threat arrows or score owner", async () => {
    const store = createStore();
    const tab = "analysis-return-mode";
    store.set(tabsAtom, [
        { value: tab, name: "Analysis", type: "analysis", gameOrigin: { kind: "none" } },
    ]);
    store.set(activeTabAtom, tab);
    await store.set(enginesAtom, [engine]);
    store.set(currentThreatAtom, true);
    const position = { fen: INITIAL_FEN, gameMoves: ["e2e4"] };
    const memory = new AnalysisLineMemory();
    memory.set(analysisSearch(position.fen, position.gameMoves, true).key, lines("d2d4"));
    store.set(engineMovesFamily({ tab, engine: engine.id }), memory);
    expect(store.get(firstEngineWithLinesFamily(position))).toBe(engine.id);
    expect(store.get(bestMovesFamily(position)).size).toBe(1);
    expect(store.get(bestMovesFamily({ fen: INITIAL_FEN, gameMoves: ["d2d4"] })).size).toBe(0);
    store.set(currentThreatAtom, false);
    expect(store.get(firstEngineWithLinesFamily(position))).toBeNull();
    expect(store.get(bestMovesFamily(position)).size).toBe(0);
    expect(memory.size).toBe(1);
    disposeTabAtoms(tab);
});

test("atom display selection refreshes LRU recency and tab close disposes line memory", async () => {
    const store = createStore();
    const tab = "analysis-lru-tab-close";
    store.set(tabsAtom, [
        { value: tab, name: "Analysis", type: "analysis", gameOrigin: { kind: "none" } },
    ]);
    store.set(activeTabAtom, tab);
    await store.set(enginesAtom, [engine]);
    store.set(currentThreatAtom, false);
    const position = { fen: INITIAL_FEN, gameMoves: [] };
    const key = analysisSearch(position.fen, position.gameMoves, false).key;
    const memory = new AnalysisLineMemory();
    memory.set(key, lines("e2e4"));
    for (let i = 0; i < 255; i++) memory.set(String(i), lines("d2d4"));
    const param = { tab, engine: engine.id };
    store.set(engineMovesFamily(param), memory);
    expect(store.get(bestMovesFamily(position)).size).toBe(1);
    memory.set("new", lines("g1f3"));
    expect(memory.has(key)).toBe(true);
    expect(memory.has("0")).toBe(false);
    expect(store.get(firstEngineWithLinesFamily(position))).toBe(engine.id);
    disposeTabAtoms(tab);
    expect(store.get(engineMovesFamily(param)).size).toBe(0);
    expect(store.get(engineMovesFamily(param))).toBeInstanceOf(AnalysisLineMemory);
    disposeTabAtoms(tab);
});

test("line readers ignore unloaded engines, empty entries and absent tab or engine list", async () => {
    const store = createStore();
    const tab = "analysis-reader-guards";
    store.set(tabsAtom, [
        { value: tab, name: "Analysis", type: "analysis", gameOrigin: { kind: "none" } },
    ]);
    const position = { fen: INITIAL_FEN, gameMoves: [] };
    store.set(activeTabAtom, null);
    expect(store.get(bestMovesFamily(position)).size).toBe(0);
    expect(store.get(firstEngineWithLinesFamily(position))).toBeNull();
    store.set(activeTabAtom, tab);
    store.set(currentThreatAtom, false);

    expect(store.get(bestMovesFamily(position)).size).toBe(0);
    expect(store.get(firstEngineWithLinesFamily(position))).toBeNull();
    await store.set(enginesAtom, [{ ...engine, loaded: false }]);
    store.set(
        engineMovesFamily({ tab, engine: engine.id }),
        new Map([[`${INITIAL_FEN}:`, lines("e2e4")]]),
    );
    expect(store.get(bestMovesFamily(position)).size).toBe(0);
    expect(store.get(firstEngineWithLinesFamily(position))).toBeNull();
    await store.set(enginesAtom, [engine]);
    store.set(engineMovesFamily({ tab, engine: engine.id }), new Map([[`${INITIAL_FEN}:`, []]]));
    expect(store.get(bestMovesFamily(position)).size).toBe(0);
    expect(store.get(firstEngineWithLinesFamily(position))).toBeNull();
    disposeTabAtoms(tab);
});
