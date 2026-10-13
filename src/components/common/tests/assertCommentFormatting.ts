import { expect } from "vitest";
import {
    type CommentDialectCase,
    commentMarkedText,
    commentMarkSelector,
} from "./commentDialectCases";

/** Compare mark coverage across the reader and editor, including literal editor escapes. */
export function assertCommentFormatting(
    element: Element,
    fixture: Pick<CommentDialectCase, "text" | "editorText" | "formatting" | "absent">,
    editor = false,
): void {
    for (const selector of fixture.absent) {
        expect(element.querySelector(commentMarkSelector(selector))).toBeNull();
    }
    for (const mark of fixture.formatting) {
        const expected =
            editor && fixture.editorText !== undefined && mark.text === fixture.text
                ? fixture.editorText
                : mark.text;
        expect(commentMarkedText(element, mark.selector).replace(/\s/g, "")).toBe(
            expected.replace(/\s/g, ""),
        );
    }
}
