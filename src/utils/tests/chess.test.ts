import { expect, test } from "vitest";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import { hasMorePriority, parseStartHeader } from "../chess";
import { defaultTree } from "../treeReducer";

test("NAGs are consistent", () => {
    for (const k of Object.keys(ANNOTATION_INFO)) {
        if (k === "") continue;
        const nag = ANNOTATION_INFO[k as Annotation].nag!;
        expect(NAG_INFO.get(`$${nag}`)).toBe(k);
    }
});

test("priority comparison", () => {
    expect(hasMorePriority([0, 0], [0])).toBe(false);
    expect(hasMorePriority([0], [0, 0])).toBe(true);
    expect(hasMorePriority([0], [1])).toBe(true);
    expect(hasMorePriority([1], [0])).toBe(false);
    expect(hasMorePriority([0, 0], [0, 1])).toBe(true);
    expect(hasMorePriority([0, 1], [0, 0])).toBe(false);
    expect(hasMorePriority([0, 1], [0, 2])).toBe(true);
    expect(hasMorePriority([0, 2], [0, 1])).toBe(false);
});

test("Start headers accept only bounded existing nonnegative paths", () => {
    const tree = defaultTree();
    tree.root.children.push({ ...tree.root, children: [] });
    expect(parseStartHeader([0], tree.root)).toEqual([0]);
    expect(parseStartHeader([-1], tree.root)).toEqual([]);
    expect(parseStartHeader([1], tree.root)).toEqual([]);
    expect(parseStartHeader("[0]", tree.root)).toEqual([]);
    expect(parseStartHeader(Array(513).fill(0), tree.root)).toEqual([]);
});
