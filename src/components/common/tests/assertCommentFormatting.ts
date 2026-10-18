import { expect } from "vitest";
import {
    type CommentDialectCase,
    commentMarkedText,
    commentMarkSelector,
} from "./commentDialectCases";

/** Compare mark coverage across the reader and editor. */
export function assertCommentFormatting(
    element: Element,
    fixture: Pick<CommentDialectCase, "text" | "formatting" | "absent">,
): void {
    for (const selector of fixture.absent) {
        expect(element.querySelector(commentMarkSelector(selector))).toBeNull();
    }
    for (const mark of fixture.formatting) {
        expect(commentMarkedText(element, mark.selector).replace(/\s/g, "")).toBe(
            mark.text.replace(/\s/g, ""),
        );
    }
}
