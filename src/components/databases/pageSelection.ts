export function getAdjacentRecordId(
    records: readonly { id: number }[],
    selectedId: number | undefined,
    direction: -1 | 1,
): number | undefined {
    const currentIndex = records.findIndex((record) => record.id === selectedId);
    const nextIndex = currentIndex + direction;
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= records.length) {
        return undefined;
    }
    return records[nextIndex].id;
}
