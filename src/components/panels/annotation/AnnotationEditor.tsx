import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { type Editor, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAtomValue } from "jotai";
import type { marked } from "marked";
import { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { spellCheckAtom } from "@/state/atoms";
import { createCommentMarkdown } from "@/utils/commentMarkdown";
import { getNodeAtPath } from "@/utils/treeReducer";

const CommentEscape = Extension.create({
  name: "commentEscape",
  markdownTokenName: "escape",
  parseMarkdown: (token, helpers) => helpers.createTextNode(token.raw ?? ""),
});

const CommentStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) => {
      if (extension.name === "paragraph") {
        return extension.extend({
          // A literal &nbsp; is comment text, not Tiptap's empty-paragraph sentinel.
          parseMarkdown: (token, helpers) =>
            helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens ?? [])),
        });
      }
      if (extension.name === "link") {
        return extension.extend({
          renderMarkdown: (node, helpers) => {
            const href = node.attrs?.href ?? "";
            // Autolinks may contain unmatched parentheses. Delimit the destination so
            // reparsing cannot move its closing characters into the comment text.
            const destination = /[()]/.test(href) ? `<${href}>` : href;
            const title = node.attrs?.title ? ` "${node.attrs.title}"` : "";
            return `[${helpers.renderChildren(node)}](${destination}${title})`;
          },
        });
      }
      return extension;
    });
  },
});

function commentMarkdown(editor: Editor) {
  // MarkdownManager treats literal &nbsp; text as an empty serialization, too.
  return (
    editor.getMarkdown() || editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n\n")
  );
}

function AnnotationEditor() {
  "use no memo";
  // The React compiler would retain the mutable Marked instance across editor recreations.
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const setComment = useStore(store, (s) => s.setComment);

  const currentNode = getNodeAtPath(root, position);
  const spellCheck = useAtomValue(spellCheckAtom);
  const editor = useEditor(
    {
      autofocus: false,
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
            autolink: true,
            openOnClick: false,
          },
        }),
        Underline.extend({
          markdownTokenizer: {
            name: "underline",
            level: "inline",
            // Undefined inherits the parent's tokenizer. This defined no-op suppresses it.
            start: () => -1,
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
        setComment(commentMarkdown(editor));
      },
    },
    [position.join(",")],
  );

  const nodeIdentity = `${position.join(",")}:${currentNode.fen}`;
  const lastExternal = useRef<{ identity: string; comment: string } | undefined>(undefined);
  useEffect(() => {
    if (!editor) return;
    const comment = currentNode.comment || "";
    const previous = lastExternal.current;
    lastExternal.current = { identity: nodeIdentity, comment };
    // Do not feed the editor's own update back into ProseMirror: that resets
    // its selection on every keystroke.  A node switch or external mutation is
    // the only time renderer content must be replaced.
    if (previous?.identity === nodeIdentity && commentMarkdown(editor) === comment) return;
    if (commentMarkdown(editor) !== comment) {
      editor.commands.setContent(comment, { emitUpdate: false, contentType: "markdown" });
    }
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
    </RichTextEditor>
  );
}

export default AnnotationEditor;
