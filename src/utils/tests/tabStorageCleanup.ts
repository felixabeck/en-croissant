import type { TabStorageRepository } from "@/state/store/tabStorage";

export function createTabStorageCleanup(staticRepository?: TabStorageRepository) {
    const repositories = new Set<TabStorageRepository>();
    if (staticRepository) repositories.add(staticRepository);

    return {
        track(repository: TabStorageRepository) {
            repositories.add(repository);
        },
        drain() {
            for (const repository of repositories) {
                for (const id of repository.flush()) repository.remove(id);
            }
            repositories.clear();
            // Static imports remain in use after module resets and between tests.
            if (staticRepository) repositories.add(staticRepository);
        },
    };
}
