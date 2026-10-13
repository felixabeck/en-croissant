import { MantineProvider } from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { Provider, createStore } from "jotai";
import { marked } from "marked";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  commentDialectCases,
  forbiddenCommentElements,
} from "@/components/common/tests/commentDialectCases";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { defaultTree } from "@/utils/treeReducer";
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
  "loads without writing and saves only the edit: $name",
  async ({ input, edited }) => {
    await mount(input);

    expect(writeComment).not.toHaveBeenCalled();
    expect(store.getState().currentNode().comment).toBe(input);
    expect(editorElement().querySelector(forbiddenCommentElements)).toBeNull();
    await act(async () => {
      const end = editor().state.doc.content.size - 1;
      // Append an unformatted edit, independently of the preceding text's marks.
      editor().view.dispatch(editor().state.tr.insert(end, editor().schema.text("!", [])));
    });
    const expected = edited ?? input + "!";
    expect(writeComment).toHaveBeenCalledExactlyOnceWith(expected);
    expect(store.getState().currentNode().comment).toBe(expected);
  },
);

test.each(["1. ", "# ", "> ", "- ", "---", "```", "`x`"])(
  "typing %j stays paragraph text and saves the literal markers",
  async (marker) => {
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
    expect(store.getState().currentNode().comment).toBe(marker + "typed text");
  },
);

function registeredCounts(instance: typeof marked) {
  return {
    inline: instance.defaults.extensions?.inline?.length ?? 0,
    block: instance.defaults.extensions?.block?.length ?? 0,
  };
}

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
  expect(counts[0].inline).toBeGreaterThan(0);
  expect(counts).toEqual(instances.map(() => counts[0]));
  expect(instances.map(registeredCounts)).toEqual(counts);
  expect(registeredCounts(marked)).toEqual(globalCounts);
  expect(writeComment).not.toHaveBeenCalled();
});
