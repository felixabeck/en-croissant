import type { TabStorageRepository } from "@/state/store/tabStorage";

export function createTabStorageCleanup() {
    const repositories = new Set<TabStorageRepository>();

    return {
        track(repository: TabStorageRepository) {
            repositories.add(repository);
        },
        drain() {
            for (const repository of repositories) {
                for (const id of repository.flush()) repository.remove(id);
            }
            repositories.clear();
        },
    };
}
