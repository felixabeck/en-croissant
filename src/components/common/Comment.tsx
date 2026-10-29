import { Typography } from "@mantine/core";
import { Fragment, memo, type ReactNode } from "react";
import { readCommentNotation, type CommentNotationNode } from "@/utils/commentNotation";
import classes from "./GameNotation.module.css";

function renderNotation(nodes: CommentNotationNode[], multipleLine: boolean): ReactNode {
  return nodes.map((node, index) => {
    const children = "content" in node ? renderNotation(node.content, multipleLine) : undefined;
    let rendered: ReactNode;
    switch (node.type) {
      case "paragraph":
        rendered = multipleLine ? <p>{children}</p> : <span>{children}</span>;
        break;
      case "bold":
        rendered = <strong>{children}</strong>;
        break;
      case "italic":
        rendered = <em>{children}</em>;
        break;
      case "strike":
        rendered = <del>{children}</del>;
        break;
      case "underline":
        rendered = <u>{children}</u>;
        break;
      case "link":
        rendered = (
          <a
            href={node.attrs.href}
            title={node.attrs.title ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        );
        break;
      case "hardBreak":
        rendered = <br />;
        break;
      case "space":
        rendered = "\n";
        break;
      case "text":
        rendered = node.text;
        break;
    }
    return <Fragment key={index}>{rendered}</Fragment>;
  });
}

function Comment({ comment }: { comment: string }) {
  const multipleLine = comment.split("\n").filter((v) => v.trim() !== "").length > 1;

  return (
    <Typography
      className={classes.comment}
      pl={0}
      mx={4}
      style={{
        display: multipleLine ? "block" : "inline",
      }}
    >
      {renderNotation(readCommentNotation(comment), multipleLine)}
    </Typography>
  );
}

export default memo(Comment);
