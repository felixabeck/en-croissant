import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import {
  Extension,
  getExtensionField,
  type JSONContent,
  type MarkdownParseResult,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAtomValue } from "jotai";
import equal from "fast-deep-equal";
import type { marked } from "marked";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { spellCheckAtom } from "@/state/atoms";
import { createCommentMarkdown, type CommentMarkdownToken } from "@/utils/commentMarkdown";
import {
  compareCommentDocument,
  flattenCommentDocument,
  normalizeCommentDocument,
} from "@/utils/commentSerializer";
import { getNodeAtPath } from "@/utils/treeReducer";

const CommentEscape = Extension.create({
  name: "commentEscape",
  markdownTokenName: "escape",
  parseMarkdown: (token, helpers) => helpers.createTextNode(token.text!),
});

export function includeHardBreakMarks(parsed: MarkdownParseResult): MarkdownParseResult {
  if (!("mark" in parsed)) return parsed;
  const mark = { type: parsed.mark, ...(parsed.attrs ? { attrs: parsed.attrs } : {}) };
  // Tiptap applies the enclosing mark to text only. Complete that same parse
  // result for breaks before the manager handles the text, without a transaction.
  const apply = (content: JSONContent[]): JSONContent[] =>
    content.map((node) => ({
      ...node,
      ...(node.type === "hardBreak" ? { marks: [...(node.marks ?? []), mark] } : {}),
      ...(node.content ? { content: apply(node.content) } : {}),
    }));
  return { ...parsed, content: apply(parsed.content ?? []) };
}

const CommentStarterKit = StarterKit.extend({
  addExtensions() {
    return this.parent!().map((extension) => {
      if (extension.name === "paragraph") {
        return extension.extend({
          // The manager's paragraph fallback keeps literal &nbsp; as comment text.
          parseMarkdown: () => undefined,
        });
      }
      const parseMarkdown = getExtensionField(extension, "parseMarkdown");
      return extension.extend({
        parseMarkdown:
          parseMarkdown &&
          ((token, helpers) => includeHardBreakMarks(parseMarkdown(token, helpers))),
      });
    });
  },
});

const notationMarkdown = createCommentMarkdown();

// Mirror Comment's rendered text and marks, including raw disallowed links.
export function parseNotationComment(source: string): JSONContent {
  const inline = (
    tokens: CommentMarkdownToken[],
    marks: NonNullable<JSONContent["marks"]> = [],
  ): JSONContent[] =>
    tokens.flatMap((token): JSONContent[] => {
      const type = { strong: "bold", em: "italic", del: "strike", underline: "underline" }[
        token.type
      ];
      if (token.type === "link" && !/^(?:https?:|mailto:)/i.test(token.href!)) {
        return [{ type: "text", text: token.raw, marks }];
      }
      if (type || token.type === "link") {
        const mark = type
          ? { type }
          : { type: "link", attrs: { href: token.href, title: token.title ?? null } };
        return inline(token.tokens!, [...marks, mark]);
      }
      if (token.type === "br") return [{ type: "hardBreak", marks }];
      // The comment lexer disables block constructs, HTML and images. The
      // remaining tokens are paragraphs, text and decoded escapes.
      return token.tokens
        ? inline(token.tokens, marks)
        : [{ type: "text", text: token.text!, marks }];
    });
  return {
    type: "doc",
    content: (notationMarkdown.lexer(source) as CommentMarkdownToken[])
      .filter((token) => token.type !== "space")
      .map((token) => ({ type: "paragraph", content: inline([token]) })),
  };
}

function AnnotationEditor() {
  "use no memo";
  // The React compiler would retain the mutable Marked instance across editor recreations.
  const { t } = useTranslation();
  const [saveFailed, setSaveFailed] = useState<boolean>();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const setComment = useStore(store, (s) => s.setComment);

  const currentNode = getNodeAtPath(root, position);
  const spellCheck = useAtomValue(spellCheckAtom);
  const editor = useEditor(
    {
      extensions: [
        CommentStarterKit.configure({
          heading: false,
          blockquote: false,
          horizontalRule: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          listKeymap: false,
          codeBlock: false,
          code: false,
          underline: false,
          link: {
            openOnClick: false,
          },
        }),
        Underline.extend({
          parseMarkdown(token, helpers) {
            return includeHardBreakMarks(
              getExtensionField(Underline, "parseMarkdown")!(token, helpers),
            );
          },
          markdownTokenizer: {
            name: "underline",
            level: "inline",
            // Undefined inherits the parent's tokenizer. This defined no-op suppresses it.
            tokenize: () => undefined,
          },
        }),
        Markdown.configure({
          // Tiptap types this as the singleton, but uses only the instance's lexer/use API.
          marked: createCommentMarkdown() as unknown as typeof marked,
        }),
        CommentEscape,
        Placeholder.configure({ placeholder: t("Board.Annotate.WriteHere") }),
      ],
      content: currentNode.comment || null,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        const result = compareCommentDocument(editor.getJSON(), [
          (source) => editor.markdown!.parse(source),
          parseNotationComment,
        ]);
        if (result.saved) setComment(result.source);
        setSaveFailed(!result.saved);
      },
    },
    [position.join()],
  );

  const nodeIdentity = `${position.join()}:${currentNode.fen}`;
  useEffect(() => {
    if (!editor) return;
    const comment = currentNode.comment;
    const expected = flattenCommentDocument(normalizeCommentDocument(editor.getJSON()));
    // Equivalent source spellings must not replace the document or move its caret.
    const matches = [editor.markdown!.parse(comment), parseNotationComment(comment)].every(
      (document) => equal(flattenCommentDocument(document), expected),
    );
    if (!matches) {
      editor.commands.setContent(comment, { emitUpdate: false, contentType: "markdown" });
    }
    setSaveFailed(false);
  }, [currentNode.comment, editor, nodeIdentity]);

  return (
    <RichTextEditor
      editor={editor}
      spellCheck={spellCheck}
      labels={{
        boldControlLabel: t("RichText.Bold"),
        italicControlLabel: t("RichText.Italic"),
        underlineControlLabel: t("RichText.Underline"),
        strikeControlLabel: t("RichText.Strike"),
        clearFormattingControlLabel: t("RichText.ClearFormatting"),
        linkControlLabel: t("RichText.Link"),
        unlinkControlLabel: t("RichText.RemoveLink"),
      }}
    >
      <RichTextEditor.Toolbar>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.ClearFormatting />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content />
      {saveFailed && <div role="alert">{t("Board.Annotate.SaveFailed")}</div>}
    </RichTextEditor>
  );
}

export default AnnotationEditor;
