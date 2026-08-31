import { tauri } from "@/platform/tauri";
import type { Color } from "@lichess-org/chessground/types";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { z } from "zod";
import {
  type BestMoves,
  type EngineOptions,
  type GoMode,
  type NormalizedGame,
  type PathRef,
} from "@/bindings";
import { parsePGN, uciNormalize } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import {
  getLichessGamesQueryParams,
  getMasterGamesQueryParams,
  type LichessGamesOptions,
  type MasterGamesOptions,
} from "@/utils/lichess/explorer";
import { countMainPly } from "@/utils/treeReducer";

export const MIN_DATE = new Date(1952, 0, 1);

export type TablebaseCategory =
  | "win"
  | "unknown"
  | "maybe-win"
  | "cursed-win"
  | "draw"
  | "blessed-loss"
  | "maybe-loss"
  | "loss";

type TablebaseData = {
  checkmate: boolean;
  stalemate: boolean;
  variant_win: boolean;
  variant_loss: boolean;
  insufficient_material: boolean;
  dtz: number;
  precise_dtz: number;
  dtm: number;
  category: TablebaseCategory;
  moves: TablebaseMove[];
};

export type TablebaseMove = {
  uci: string;
  san: string;
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
  variant_win: boolean;
  variant_loss: boolean;
  insufficient_material: boolean;
  dtz: number;
  precise_dtz: number;
  dtm: number;
  category: TablebaseCategory;
};

type LichessPerf = {
  games: number;
  rating: number;
  rd: number;
  prog: number;
  prov: boolean;
};

export type LichessAccount = {
  id: string;
  username: string;
  perfs?: {
    chess960?: LichessPerf;
    atomic?: LichessPerf;
    racingKings?: LichessPerf;
    ultraBullet?: LichessPerf;
    blitz?: LichessPerf;
    kingOfTheHill?: LichessPerf;
    bullet?: LichessPerf;
    correspondence?: LichessPerf;
    horde?: LichessPerf;
    puzzle?: LichessPerf;
    classical?: LichessPerf;
    rapid?: LichessPerf;
    storm?: {
      runs: number;
      score: number;
    };
  };
  createdAt?: number;
  disabled?: boolean;
  tosViolation?: boolean;
  profile?: {
    country: string;
    location: string;
    bio: string;
    firstName: string;
    lastName: string;
    fideRating: number;
    uscfRating: number;
    ecfRating: number;
    links: string;
  };
  seenAt?: number;
  patron?: boolean;
  verified?: boolean;
  playTime?: {
    total: number;
    tv: number;
  };
  title?: string;
  url?: string;
  playing?: string;
  completionRate?: number;
  count?: {
    all: number;
    rated: number;
    ai: number;
    draw: number;
    drawH: number;
    loss: number;
    lossH: number;
    win: number;
    winH: number;
    bookmark: number;
    playing: number;
    import: number;
    me: number;
  };
  streaming?: boolean;
  followable?: boolean;
  following?: boolean;
  blocking?: boolean;
  followsYou?: boolean;
};

const lichessAccountSchema = z
  .object({
    id: z.string().min(1),
    username: z.string().min(1),
  })
  .passthrough();

const positionDataSchema = z
  .object({
    white: z.number(),
    black: z.number(),
    draws: z.number(),
    moves: z.array(
      z.object({
        uci: z.string(),
        san: z.string(),
        averageRating: z.number(),
        white: z.number(),
        black: z.number(),
        draws: z.number(),
      }),
    ),
  })
  .passthrough();

function parseNativeJson<T>(body: string, schema: z.ZodType<T>): T {
  const parsed = JSON.parse(body) as unknown;
  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error("Lichess returned an invalid response");
  return result.data;
}

type PositionGames = {
  uci: string;
  id: string;
  winner: string | null;
  speed: string;
  mode: string;
  black: {
    name: string;
    rating: number;
  };
  white: {
    name: string;
    rating: number;
  };
  year: number;
  month: string;
}[];

export async function convertToNormalized(data: PositionGames): Promise<NormalizedGame[]> {
  const results = await Promise.allSettled(
    data.map(async (game, i) => {
      const pgn = await getLichessGame(game.id);
      const { headers, root } = await parsePGN(pgn);
      const normalized: NormalizedGame = {
        ...headers,
        id: i,
        white_id: 0,
        black_id: 0,
        event_id: 0,
        site_id: 0,
        moves: pgn,
        ply_count: countMainPly(root),
        // ply_count: root,
      };
      return normalized;
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

type PositionData = {
  white: number;
  black: number;
  draws: number;
  moves: {
    uci: string;
    san: string;
    averageRating: number;
    white: number;
    black: number;
    draws: number;
  }[];
  recentGames?: PositionGames;
  topGames?: PositionGames;
};

export async function getLichessAccount({
  handle,
  username,
}: {
  handle?: string;
  username?: string;
}): Promise<LichessAccount | null> {
  if (handle) {
    const result = await tauri.getAuthenticatedLichessAccount(handle);
    try {
      return parseNativeJson(result, lichessAccountSchema) as LichessAccount;
    } catch {
      return null;
    }
  } else {
    if (!username) return null;
    const result = await tauri.getPublicLichessJson({ kind: "account", username });
    try {
      return parseNativeJson(result, lichessAccountSchema) as LichessAccount;
    } catch {
      return null;
    }
  }
}

export async function getBestMoves(
  _tab: string,
  _goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  const [pos] = positionFromFen(options.fen);
  if (!pos) {
    return null;
  }
  for (const uci of options.moves) {
    const m = parseUci(uci);
    if (!m) {
      return null;
    }
    pos.play(m);
  }
  const data = await getCloudEvaluation(
    makeFen(pos.toSetup()),
    Number.parseInt(
      (
        options.extraOptions.find((o) => o.name === "MultiPV" && o.type === "string") as
          | { value: string }
          | undefined
      )?.value ?? "1",
    ),
  );
  return [
    100,
    data.pvs?.map((m, i) => {
      const uciMoves = m.moves.split(" ");
      const posCopy = pos.clone();
      const normalizedUciMoves: string[] = [];

      const sanMoves = uciMoves.map((m) => {
        const move = parseUci(m)!;
        const san = makeSan(posCopy, move);
        normalizedUciMoves.push(uciNormalize(posCopy, move));
        posCopy.play(move);
        return san;
      });

      return {
        score: {
          value: "cp" in m ? { type: "cp", value: m.cp } : { type: "mate", value: m.mate },
          wdl: null,
        },
        nodes: BigInt(data.knodes) * 1000n,
        depth: data.depth,
        multipv: i + 1,
        nps: 0n,
        sanMoves,
        uciMoves: normalizedUciMoves,
      };
    }) ?? [],
  ];
}

const cache = new Map<string, LichessCloudData>();

type LichessCloudData = {
  fen: string;
  knodes: number;
  depth: number;
  pvs: (LichessCp | LichessMate)[];
};

type LichessCp = {
  cp: number;
  moves: string;
};

type LichessMate = {
  mate: number;
  moves: string;
};

async function getCloudEvaluation(fen: string, multipv: number): Promise<LichessCloudData> {
  if (cache.has(`${fen}-${multipv}`)) {
    return cache.get(`${fen}-${multipv}`)!;
  }
  const result = await tauri.getPublicLichessJson({ kind: "cloud_eval", fen, multi_pv: multipv });
  const data = JSON.parse(result) as LichessCloudData;
  cache.set(`${fen}-${multipv}`, data);
  return data;
}

export async function getLichessGames(
  fen: string,
  options: LichessGamesOptions,
  handle: string,
): Promise<PositionData> {
  const endpoint = options.player ? "player" : "lichess";
  const result = await tauri.getAuthenticatedLichessExplorer(
    handle,
    endpoint,
    getLichessGamesQueryParams(fen, options),
  );
  return parseNativeJson(result, positionDataSchema) as PositionData;
}

export async function getMasterGames(
  fen: string,
  options: MasterGamesOptions,
  handle: string,
): Promise<PositionData> {
  const result = await tauri.getAuthenticatedLichessExplorer(
    handle,
    "masters",
    getMasterGamesQueryParams(fen, options),
  );
  return parseNativeJson(result, positionDataSchema) as PositionData;
}

export async function getPlayerGames(fen: string, player: string, color: Color, handle: string) {
  const params = new URLSearchParams({ fen, player, color });
  const result = await tauri.getAuthenticatedLichessExplorer(handle, "player", params.toString());
  return parseNativeJson(result, positionDataSchema) as PositionData;
}

export async function downloadLichess(
  handle: string,
  destination: PathRef,
  player: string,
  timestamp: number | null,
  games: number,
) {
  // The destination command is supplied by the native download authority.  The opaque handle
  // selects the credential in the OS keyring; renderer code never forms an Authorization header.
  const result = await tauri.downloadLichessGames(
    handle,
    destination,
    `${player}_lichess.pgn`,
    player,
    timestamp === null ? null : BigInt(timestamp),
    games > 0 ? games * 900 : null,
    crypto.randomUUID(),
  );
  // Native publication treats durability uncertainty as committed and returns the recovered
  // capability. Never retry this operation from the renderer.
  return result.handle;
}

export async function getLichessGame(gameId: string): Promise<string> {
  const result = await tauri.getPublicLichessJson({ kind: "game", game_id: gameId });
  return result;
}

export async function getTablebaseInfo(fen: string): Promise<TablebaseData> {
  const result = await tauri.getPublicLichessJson({ kind: "tablebase", fen });
  return JSON.parse(result) as TablebaseData;
}

export async function getFidePlayer(query: string) {
  if (!Number.isNaN(Number(query))) {
    const result = await tauri.getPublicLichessJson({ kind: "fide", query });
    return JSON.parse(result);
  } else {
    const result = await tauri.getPublicLichessJson({ kind: "fide", query });
    const data = JSON.parse(result);
    return data[0];
  }
  throw new Error("Player not found");
}
