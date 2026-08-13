import { Typography } from "@mantine/core";
import { memo } from "react";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName: string };
};

function underlineText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const pattern = /\+\+([^+\n](?:[^+\n]|\+(?!\+))+?)\+\+/g;
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    if (index > offset) nodes.push({ type: "text", value: value.slice(offset, index) });
    nodes.push({
      type: "underline",
      data: { hName: "u" },
      children: [{ type: "text", value: match[1] }],
    });
    offset = index + match[0].length;
  }
  if (offset < value.length) nodes.push({ type: "text", value: value.slice(offset) });
  return nodes.length > 0 ? nodes : [{ type: "text", value }];
}

function remarkUnderline() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children || node.type === "code" || node.type === "inlineCode") return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text" && child.value?.includes("++")) {
          return underlineText(child.value);
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
  };
}

function Comment({ comment }: { comment: string }) {
  const multipleLine = comment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <Typography
      pl={0}
      mx={4}
      style={{
        display: multipleLine ? "block" : "inline",
      }}
    >
      <Markdown
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          p: ({ node: _node, ...props }) => (multipleLine ? <p {...props} /> : <span {...props} />),
        }}
        remarkPlugins={[remarkGfm, remarkUnderline]}
      >
        {comment}
      </Markdown>
    </Typography>
  );
}

export default memo(Comment);
