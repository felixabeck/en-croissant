export function accountDatabaseFilename(username: string, type: "lichess" | "chesscom"): string {
    return `${username}_${type}.db3`;
}
