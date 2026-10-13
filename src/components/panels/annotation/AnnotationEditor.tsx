import { RichTextEditor } from "@mantine/tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAtomValue } from "jotai";
import { Marked, type marked, type Tokens } from "marked";
import { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { spellCheckAtom } from "@/state/atoms";
import { getNodeAtPath } from "@/utils/treeReducer";

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
        StarterKit.configure({
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
            start: (source) => source.indexOf("++"),
            tokenize: (source, _tokens, lexer) => {
              const match = /^\+\+((?!\s)(?:(?!\+\+)[^\n])*?[^\s\n])\+\+/.exec(source);
              if (!match) return undefined;
              return {
                type: "underline",
                raw: match[0],
                text: match[1],
                tokens: lexer.inlineTokens(match[1]),
              };
            },
          },
        }),
        Markdown.configure({
          marked: new Marked({
            tokenizer: {
              heading: () => undefined,
              lheading: () => undefined,
              blockquote: () => undefined,
              hr: () => undefined,
              list: () => undefined,
              code: () => undefined,
              fences: () => undefined,
              html: () => undefined,
              def: () => undefined,
              table: () => undefined,
              codespan: () => undefined,
              escape: (source) => {
                const match = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.exec(source);
                // Marked accepts a text token here, though its escape override type is narrower.
                if (match)
                  return {
                    type: "text",
                    raw: match[0],
                    text: match[0],
                  } as unknown as Tokens.Escape;
                return undefined;
              },
            },
            // Tiptap types this as the singleton, but uses only the instance's lexer/use API.
          }) as unknown as typeof marked,
        }),
        Placeholder.configure({ placeholder: t("Board.Annotate.WriteHere") }),
      ],
      content: currentNode.comment || null,
      contentType: "markdown",
      onUpdate: ({ editor }) => {
        setComment(editor.getMarkdown());
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
    if (previous?.identity === nodeIdentity && editor.getMarkdown() === comment) return;
    if (editor.getMarkdown() !== comment) {
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
