import type { DailyStatsData } from "@/bindings";

export function summarizeDailyStats(dailyStats: DailyStatsData[]) {
    let won = 0;
    let draw = 0;
    let lost = 0;

    for (const day of dailyStats) {
        won += day.won;
        draw += day.drawn;
        lost += day.lost;
    }

    return { total: won + draw + lost, won, draw, lost };
}
