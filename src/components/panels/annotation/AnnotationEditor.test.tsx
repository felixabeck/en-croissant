import { MantineProvider } from "@mantine/core";
import type { Editor, JSONContent } from "@tiptap/react";
import { Provider, createStore } from "jotai";
import { marked } from "marked";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import Comment from "@/components/common/Comment";
import {
  commentDialectCases,
  commentDomText,
  commentMarkedText,
  forbiddenCommentElements,
} from "@/components/common/tests/commentDialectCases";
import { assertCommentFormatting } from "@/components/common/tests/assertCommentFormatting";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { defaultTree } from "@/utils/treeReducer";
import { createCommentMarkdown } from "@/utils/commentMarkdown";
import { flattenCommentDocument } from "@/utils/commentSerializer";
import AnnotationEditor from "./AnnotationEditor";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let store: TreeStore;
let writeComment: ReturnType<typeof vi.fn<(comment: string) => void>>;

beforeEach(() => {
  installMatchMediaStub();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  store?.dispose();
  host.remove();
  vi.restoreAllMocks();
});

async function mount(comment: string) {
  const initial = defaultTree();
  initial.root.comment = comment;
  store = createTreeStore(undefined, initial);
  const originalSetComment = store.getState().setComment;
  writeComment = vi.fn(originalSetComment);
  store.setState({ setComment: writeComment });
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={createStore()}>
          <TreeStateContext.Provider value={store}>
            <AnnotationEditor />
          </TreeStateContext.Provider>
        </Provider>
      </MantineProvider>,
    );
  });
}

function editorElement() {
  return host.querySelector<HTMLElement & { editor: Editor }>(".tiptap")!;
}

function editor() {
  return editorElement().editor;
}

function observeSetContent() {
  // Tiptap creates a command facade on each getter call. Observe the same facade
  // that the component will receive, so an unexpected sync is actually counted.
  const commands = editor().commands;
  const facade = vi.spyOn(editor(), "commands", "get").mockReturnValue(commands);
  const setContent = vi.spyOn(commands, "setContent");
  return {
    setContent,
    restore: () => {
      setContent.mockRestore();
      facade.mockRestore();
    },
  };
}

test("keeps inline controls and removes every block control", async () => {
  await mount("59. Olvidé mi preparación.");

  const labels = [...host.querySelectorAll("button")].map((button) =>
    button.getAttribute("aria-label"),
  );
  expect(labels).toEqual([
    "RichText.Bold",
    "RichText.Italic",
    "RichText.Underline",
    "RichText.Strike",
    "RichText.ClearFormatting",
    "RichText.Link",
    "RichText.RemoveLink",
  ]);
  expect(
    editor()
      .getJSON()
      .content?.map((node) => node.type),
  ).toEqual(["paragraph"]);
  expect(editorElement().querySelector(forbiddenCommentElements)).toBeNull();
  expect(writeComment).not.toHaveBeenCalled();
});

test.each(commentDialectCases)(
  "loads without writing and preserves text on edit while syntax may normalize: $name",
  async ({ input, edited, text, formatting, absent }) => {
    await mount(input);

    expect(writeComment).not.toHaveBeenCalled();
    expect(store.getState().currentNode().comment).toBe(input);
    expect(editor().markdown!.instance.lexer(input)).toEqual(createCommentMarkdown().lexer(input));
    expect(editorElement().querySelector(forbiddenCommentElements)).toBeNull();
    expect(commentDomText(editorElement())).toBe(text);
    const fixture = { text, formatting, absent };
    assertCommentFormatting(editorElement(), fixture);
    await act(async () => {
      const end = editor().state.doc.content.size - 1;
      // Append an unformatted edit, independently of the preceding text's marks.
      editor().view.dispatch(editor().state.tr.insert(end, editor().schema.text("!", [])));
    });
    const expected = edited ?? input + "!";
    expect(writeComment).toHaveBeenCalledExactlyOnceWith(expected);
    expect(store.getState().currentNode().comment).toBe(expected);
    await act(async () => {
      editor().commands.setContent(expected, { emitUpdate: false, contentType: "markdown" });
    });
    expect(commentDomText(editorElement())).toBe(text + "!");
    assertCommentFormatting(editorElement(), fixture);
    const readerHost = document.createElement("div");
    const readerRoot = createRoot(readerHost);
    try {
      await act(async () =>
        readerRoot.render(
          <MantineProvider>
            <div data-comment-reader>
              <Comment comment={expected} />
            </div>
          </MantineProvider>,
        ),
      );
      const readerContent = readerHost.querySelector("[data-comment-reader]")!;
      expect(commentDomText(readerContent)).toBe(text + "!");
      assertCommentFormatting(readerContent, fixture);
    } finally {
      await act(async () => readerRoot.unmount());
    }
  },
);

test.each([
  ["1. ", "1. "],
  ["# ", "# "],
  ["> ", "\\> "],
  ["- ", "- "],
  ["---", "---"],
  ["```", "```"],
  ["`x`", "`x`"],
])("typing %j stays paragraph text and saves the literal markers", async (marker, source) => {
  await mount("seed");
  await act(async () => {
    editor().commands.clearContent(false);
  });
  expect(writeComment).not.toHaveBeenCalled();
  // Exercise ProseMirror's text-input handlers so enabled input rules would transform markers.
  await act(async () => {
    const view = editor().view;
    for (const character of marker + "typed text") {
      const { from, to } = view.state.selection;
      let handled = false;
      view.someProp("handleTextInput", (handler) => {
        handled =
          handler(view, from, to, character, () =>
            view.state.tr.insertText(character, from, to),
          ) === true;
        return handled;
      });
      if (!handled) view.dispatch(view.state.tr.insertText(character, from, to));
    }
  });

  expect(
    editor()
      .getJSON()
      .content?.map((node) => node.type),
  ).toEqual(["paragraph"]);
  expect(editorElement().querySelector(forbiddenCommentElements)).toBeNull();
  expect(editorElement().textContent).toBe(marker + "typed text");
  expect(store.getState().currentNode().comment).toBe(source + "typed text");
});

function registeredCounts(instance: typeof marked) {
  return {
    inline: instance.defaults.extensions?.inline?.length ?? 0,
    block: instance.defaults.extensions?.block?.length ?? 0,
  };
}

async function reloadSavedComment() {
  const saved = store.getState().currentNode().comment;
  await act(async () =>
    editor().commands.setContent(saved, { emitUpdate: false, contentType: "markdown" }),
  );
  return saved;
}

test("A: Enter authors an empty paragraph without adding visible entity text", async () => {
  await mount("x");
  await act(async () => {
    editor().commands.setTextSelection(2);
    editor().commands.keyboardShortcut("Enter");
  });
  expect(editor().getJSON().content).toHaveLength(2);
  expect(store.getState().currentNode().comment).toBe("x");
  await reloadSavedComment();
  expect(commentDomText(editorElement())).toBe("x");
});

test("A: consecutive empty paragraphs normalize without writing a sentinel", async () => {
  await mount("x");
  await act(async () => {
    editor().commands.setTextSelection(2);
    editor().commands.keyboardShortcut("Enter");
    editor().commands.keyboardShortcut("Enter");
    editor().commands.insertContent("y");
  });
  expect(await reloadSavedComment()).toBe("x\n\ny");
  expect(commentDomText(editorElement())).toBe("x\n\ny");
  await act(async () => editor().commands.clearContent());
  expect(store.getState().currentNode().comment).toBe("");
});

test.each(["&nbsp;", "&nbsp;  \n&nbsp;", "&nbsp;\n\n&nbsp;", "&amp;  \n&#160;"])(
  "B: deleting the final edit preserves entity text and boundaries in %j",
  async (source) => {
    await mount(source + "!");
    await act(async () => {
      const end = editor().state.doc.content.size - 1;
      editor().view.dispatch(editor().state.tr.delete(end - 1, end));
    });
    expect(writeComment).toHaveBeenCalledExactlyOnceWith(source);
    await reloadSavedComment();
    expect(commentDomText(editorElement())).toBe(source.replace(/  \n/g, "\n"));
  },
);

test.each([`a "b"`, String.raw`a \ "b" 'c' (d)`, "line one\nline two"])(
  "C: editing a titled link preserves its title %j on reload",
  async (title) => {
    const escaped = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await mount(`[x](https://x.y "${escaped}")`);
    expect(editorElement().querySelector("a")?.getAttribute("title")).toBe(title);
    await act(async () => {
      editor().view.dispatch(editor().state.tr.insert(2, editor().schema.text("!", [])));
    });
    expect(await reloadSavedComment()).toBe(`[x](https://x.y "${escaped}")!`);
    expect(commentDomText(editorElement())).toBe("x!");
    expect(editorElement().querySelector("a")?.getAttribute("title")).toBe(title);
  },
);

test("B: typed entity text survives saving and reloading beside a hard break", async () => {
  await mount("");
  await act(async () => {
    editor().commands.insertContent("&nbsp;");
    editor().commands.keyboardShortcut("Shift-Enter");
    editor().commands.insertContent("&amp;");
  });
  expect(await reloadSavedComment()).toBe("&nbsp;  \n&amp;");
  expect(commentDomText(editorElement())).toBe("&nbsp;\n&amp;");
});

test.each([
  { mark: "underline", selector: "u", delimiter: "++" },
  { mark: "bold", selector: "strong", delimiter: "**" },
  { mark: "italic", selector: "em", delimiter: "*" },
  { mark: "strike", selector: "s", delimiter: "~~" },
])(
  "D: authored $mark keeps text and coverage at whitespace edges",
  async ({ mark, selector, delimiter }) => {
    await mount(" x ");
    await act(async () => {
      editor().commands.setTextSelection({ from: 1, to: 4 });
      editor().commands.setMark(mark);
    });
    expect(await reloadSavedComment()).toBe(` ${delimiter}x${delimiter} `);
    expect(commentDomText(editorElement())).toBe(" x ");
    expect(commentMarkedText(editorElement(), selector)).toBe("x");
  },
);

test.each(["hard", "soft"])(
  "D: authored underline closes and reopens across a %s break",
  async (kind) => {
    await mount(kind === "soft" ? "a\nb" : "ab");
    if (kind === "hard") {
      await act(async () => {
        editor().commands.setTextSelection(2);
        editor().commands.keyboardShortcut("Shift-Enter");
      });
    }
    await act(async () => {
      editor().commands.selectAll();
      editor().commands.toggleUnderline();
    });
    const saved = await reloadSavedComment();
    expect(saved).toBe(`++a++${kind === "hard" ? "  " : ""}\n++b++`);
    expect(commentDomText(editorElement())).toBe("a\nb");
    expect(commentMarkedText(editorElement(), "u")).toBe("ab");
  },
);

test.each([
  { input: "**a\nb**", expected: "**++a++\n++b++**", selector: "u strong" },
  { input: "*a\nb*", expected: "*++a++\n++b++*", selector: "u em" },
  { input: "~~a\nb~~", expected: "~~++a++\n++b++~~", selector: "u s" },
  {
    input: "[a\nb](https://x.y)",
    expected: "[++a++\n++b++](https://x.y)",
    selector: "u a",
  },
])(
  "D: authored underline preserves nested formatting across lines in $input",
  async ({ input, expected, selector }) => {
    await mount(input);
    await act(async () => {
      editor().commands.selectAll();
      editor().commands.toggleUnderline();
    });
    expect(await reloadSavedComment()).toBe(expected);
    expect(commentDomText(editorElement())).toBe("a\nb");
    expect(commentMarkedText(editorElement(), selector)).toBe("ab");
  },
);

test.each(["a   b"])(
  "D: an unrepresentable authored underline preserves %j without generated delimiters",
  async (text) => {
    await mount(text);
    await act(async () => {
      editor().commands.setTextSelection({ from: 2, to: 5 });
      editor().commands.toggleUnderline();
    });
    expect(await reloadSavedComment()).toBe(text);
    expect(commentDomText(editorElement())).toBe(text);
    expect(editorElement().querySelector("u")).toBeNull();
  },
);

type Span = { text: string; marks?: NonNullable<JSONContent["marks"]>; hardBreak?: boolean };
const underline = { type: "underline" };
const link = (href: string, title: string | null = null) => ({
  type: "link",
  attrs: { href, title },
});

function draftDocument(spans: Span[]): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: spans.map(({ text, marks, hardBreak }) => ({
          type: hardBreak ? "hardBreak" : "text",
          ...(hardBreak ? {} : { text }),
          marks,
        })),
      },
    ],
  };
}

function expectedFormatting(spans: Span[]) {
  return {
    text: spans.map((span) => span.text).join(""),
    marks: spans.flatMap((span) =>
      Array.from(span.text, () =>
        (span.marks ?? [])
          .map((mark) =>
            mark.type === "link"
              ? JSON.stringify(["link", mark.attrs!.href, mark.attrs!.title ?? null])
              : mark.type,
          )
          .sort(),
      ),
    ),
  };
}

// Read the actual rendered Comment, including whitespace and marks on br nodes.
function readerFormatting(element: Element) {
  const spans: Span[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE || (node instanceof Element && node.tagName === "BR")) {
      const marks: NonNullable<JSONContent["marks"]> = [];
      for (
        let parent = node.parentElement;
        parent && element.contains(parent);
        parent = parent.parentElement
      ) {
        const type = { STRONG: "bold", EM: "italic", DEL: "strike", U: "underline" }[
          parent.tagName
        ];
        if (type) marks.push({ type });
        if (parent.tagName === "A")
          marks.push(link(parent.getAttribute("href")!, parent.getAttribute("title")));
      }
      spans.push({ text: node.nodeType === Node.TEXT_NODE ? node.textContent! : "\n", marks });
    } else {
      node.childNodes.forEach(visit);
    }
  };
  const paragraphs = [...element.querySelectorAll("p")];
  if (paragraphs.length)
    paragraphs.forEach((paragraph, index) => {
      if (index) spans.push({ text: "\n\n" });
      visit(paragraph);
    });
  else visit(element);
  return expectedFormatting(spans);
}

async function assertSavedFormatting(spans: Span[]) {
  const wanted = expectedFormatting(spans);
  const source = await reloadSavedComment();
  expect(flattenCommentDocument(editor().getJSON())).toEqual(wanted);
  const readerHost = document.createElement("div");
  const readerRoot = createRoot(readerHost);
  try {
    await act(async () =>
      readerRoot.render(
        <MantineProvider>
          <div data-comment-reader>
            <Comment comment={source} />
          </div>
        </MantineProvider>,
      ),
    );
    expect(readerFormatting(readerHost.querySelector("[data-comment-reader]")!)).toEqual(wanted);
  } finally {
    await act(async () => readerRoot.unmount());
  }
}

const lossSeeds: { name: string; spans: Span[]; wanted?: Span[]; source: string }[] = [
  {
    name: "literal pluses beside underline",
    spans: [{ text: "a++b" }, { text: "c", marks: [underline] }],
    source: "a\\+\\+b++c++",
  },
  {
    name: "fully underlined pluses",
    spans: [{ text: "a++b", marks: [underline] }],
    source: "++a\\+\\+b++",
  },
  { name: "unmarked bold syntax", spans: [{ text: "**x**" }], source: "\\*\\*x\\*\\*" },
  ...["", "!"].map((edit) => ({
    name: `adjacent distinct links beside ${JSON.stringify(edit)}`,
    spans: [
      { text: "a", marks: [link("https://a.test")] },
      { text: "b", marks: [link("https://b.test")] },
      ...(edit ? [{ text: edit }] : []),
    ],
    source: `[a](https://a.test)[b](https://b.test)${edit}`,
  })),
  {
    name: "distinct titles",
    spans: [
      { text: "a", marks: [link("https://x.y", "first")] },
      { text: "b", marks: [link("https://x.y", "second")] },
    ],
    source: '[a](https://x.y "first")[b](https://x.y "second")',
  },
  { name: "unlinked URL", spans: [{ text: "https://a.test" }], source: "https\\://a.test" },
  {
    name: "linked underline edge spaces",
    spans: [{ text: " x ", marks: [underline, link("https://a.test")] }],
    source: "++[ x ](https://a.test)++",
  },
  {
    name: "only spaces underlined",
    spans: [{ text: "a" }, { text: "   ", marks: [underline] }, { text: "b" }],
    wanted: [{ text: "a   b" }],
    source: "a   b",
  },
  {
    name: "authored underline edge spaces",
    spans: [{ text: " x ", marks: [underline] }],
    wanted: [{ text: " " }, { text: "x", marks: [underline] }, { text: " " }],
    source: " ++x++ ",
  },
  ...[false, true].flatMap((hardBreak) => {
    const newline = hardBreak ? "  \n" : "\n";
    return [
      undefined,
      { type: "bold" },
      { type: "italic" },
      { type: "strike" },
      link("https://x.y"),
    ].map((mark) => {
      const letterMarks = [underline, ...(mark ? [mark] : [])];
      const spanningMarks = mark ? [mark] : [];
      const middle = `++a++${newline}++b++`;
      const delimiter = { bold: "**", italic: "*", strike: "~~" }[mark?.type ?? ""];
      return {
        name: `${mark?.type ?? "plain underline"} across ${hardBreak ? "hard" : "soft"} break`,
        spans: [
          { text: "a", marks: letterMarks },
          { text: "\n", marks: letterMarks, hardBreak },
          { text: "b", marks: letterMarks },
        ],
        wanted: [
          { text: "a", marks: letterMarks },
          { text: "\n", marks: spanningMarks },
          { text: "b", marks: letterMarks },
        ],
        source: !mark
          ? middle
          : mark.type === "link"
            ? `[${middle}](https://x.y)`
            : `${delimiter}${middle}${delimiter}`,
      };
    });
  }),
];

test.each(lossSeeds)(
  "saves and reloads exact text and marks: $name",
  async ({ spans, wanted, source }) => {
    await mount("previous comment");
    await act(async () => editor().commands.setContent(draftDocument(spans)));
    expect(writeComment).toHaveBeenCalledExactlyOnceWith(source);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await assertSavedFormatting(wanted ?? spans);
  },
);

test("removing a URL link saves its label without recreating the link on reload", async () => {
  await mount("[https://a.test](https://a.test)");
  await act(async () => {
    editor().commands.selectAll();
    editor().commands.unsetLink();
  });
  expect(writeComment).toHaveBeenCalledExactlyOnceWith("https\\://a.test");
  await assertSavedFormatting([{ text: "https://a.test" }]);
});

test.each([
  { name: "whitespace-only underline", spans: [{ text: "   ", marks: [underline] }] },
  { name: "empty link title", spans: [{ text: "draft", marks: [link("https://x.y", "")] }] },
  {
    name: "notation rejects the link protocol",
    spans: [{ text: "draft", marks: [link("ftp://x.y")] }],
  },
])("refuses loss without writing or replacing the draft: $name", async ({ spans }) => {
  await mount("stored comment");
  const draft = editor().schema.nodeFromJSON(draftDocument(spans));
  const { setContent, restore } = observeSetContent();
  await act(async () =>
    editor().view.dispatch(
      editor().state.tr.replaceWith(0, editor().state.doc.content.size, draft.content),
    ),
  );
  expect(editor().getJSON()).toEqual(draft.toJSON());
  expect(writeComment).not.toHaveBeenCalled();
  expect(setContent).not.toHaveBeenCalled();
  expect(store.getState().currentNode().comment).toBe("stored comment");
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Board.Annotate.SaveFailed");
  restore();
  await act(async () =>
    editor().commands.setContent(draftDocument([{ text: "fixed", marks: [underline] }])),
  );
  expect(writeComment).toHaveBeenCalledExactlyOnceWith("++fixed++");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("a throwing editor adapter refuses the save without changing the draft", async () => {
  await mount("stored comment");
  const parse = vi.spyOn(editor().markdown!, "parse").mockImplementation(() => {
    throw new Error("parse failed");
  });
  const draft = editor().schema.nodeFromJSON(
    draftDocument([{ text: "draft", marks: [underline] }]),
  );
  const { setContent } = observeSetContent();
  await act(async () =>
    editor().view.dispatch(
      editor().state.tr.replaceWith(0, editor().state.doc.content.size, draft.content),
    ),
  );
  expect(editor().getJSON()).toEqual(draft.toJSON());
  expect(writeComment).not.toHaveBeenCalled();
  expect(setContent).not.toHaveBeenCalled();
  expect(store.getState().currentNode().comment).toBe("stored comment");
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Board.Annotate.SaveFailed");
  parse.mockRestore();
});

test("sync preserves the selection for equivalent stored spelling and replaces different text", async () => {
  await mount("**x**");
  await act(async () => editor().commands.setTextSelection(2));
  const selection = editor().state.selection.toJSON();
  const document = editor().getJSON();
  const { setContent } = observeSetContent();
  await act(async () => store.getState().setComment("__x__"));
  expect(setContent).not.toHaveBeenCalled();
  expect(editor().getJSON()).toEqual(document);
  expect(editor().state.selection.toJSON()).toEqual(selection);
  expect(store.getState().currentNode().comment).toBe("__x__");
  await act(async () => store.getState().setComment("external text"));
  expect(setContent).toHaveBeenCalledExactlyOnceWith("external text", {
    contentType: "markdown",
    emitUpdate: false,
  });
  expect(editor().getText()).toBe("external text");
});

test.each([
  {
    source: "[a  \nb](https://x.y)",
    mark: expect.objectContaining({
      type: "link",
      attrs: expect.objectContaining({ href: "https://x.y", title: null }),
    }),
  },
  { source: "**a  \nb**", mark: { type: "bold" } },
  { source: "*a  \nb*", mark: { type: "italic" } },
  { source: "~~a  \nb~~", mark: { type: "strike" } },
])("loads the enclosing mark onto a hardBreak: $source", async ({ source, mark }) => {
  await mount(source);
  const hardBreak = editor()
    .getJSON()
    .content![0].content!.find((node) => node.type === "hardBreak");
  expect(hardBreak).toBeDefined();
  expect(hardBreak!.marks).toEqual([mark]);
  expect(writeComment).not.toHaveBeenCalled();
  expect(store.getState().currentNode().comment).toBe(source);
});

test.each([
  { source: "1\\.", text: "1.", saved: "1.!" },
  { source: "\\+\\+x\\+\\+", text: "++x++", saved: "\\+\\+x\\+\\+!" },
])("loads decoded escapes and saves an edit: $source", async ({ source, text, saved }) => {
  await mount(source);
  expect(editor().getText()).toBe(text);
  expect(writeComment).not.toHaveBeenCalled();
  await act(async () => {
    const end = editor().state.doc.content.size - 1;
    editor().view.dispatch(editor().state.tr.insert(end, editor().schema.text("!", [])));
  });
  expect(writeComment).toHaveBeenCalledExactlyOnceWith(saved);
  await assertSavedFormatting([{ text: text + "!" }]);
});

test("Mod-U keeps the underline mark and its Markdown serialization", async () => {
  await mount("x");
  await act(async () => {
    editor().commands.setTextSelection({ from: 1, to: 2 });
    editor().commands.keyboardShortcut("Mod-u");
  });
  expect(editorElement().querySelector("u")?.textContent).toBe("x");
  expect(writeComment).toHaveBeenCalledExactlyOnceWith("++x++");
  await act(async () => editor().commands.keyboardShortcut("Mod-U"));
  expect(editorElement().querySelector("u")).toBeNull();
  expect(store.getState().currentNode().comment).toBe("x");
});

test("node switches keep each editor's tokenizer registrations bounded and isolated", async () => {
  const globalCounts = registeredCounts(marked);
  await mount("root comment");
  await act(async () => {
    store.getState().makeMoves({ payload: ["e4", "e5", "Nf3"] });
    store.getState().goToStart();
  });
  const editors = [editor()];
  const instances = [editor().markdown!.instance];
  const counts = [registeredCounts(instances[0])];

  for (const path of [[0], [0, 0], [0, 0, 0], [], [0], []]) {
    await act(async () => store.getState().goToMove(path));
    editors.push(editor());
    instances.push(editor().markdown!.instance);
    counts.push(registeredCounts(instances.at(-1)!));
  }

  expect(new Set(editors).size).toBe(editors.length);
  expect(new Set(instances).size).toBe(instances.length);
  expect(counts[0]).toEqual({ inline: 2, block: 0 });
  expect(counts).toEqual(instances.map(() => counts[0]));
  expect(instances.map(registeredCounts)).toEqual(counts);
  expect(registeredCounts(marked)).toEqual(globalCounts);
  expect(writeComment).not.toHaveBeenCalled();
});
