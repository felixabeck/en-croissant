import { Typography } from "@mantine/core";
import { Fragment, memo, type ReactNode } from "react";
import { createCommentMarkdown, type CommentMarkdownToken } from "@/utils/commentMarkdown";

// This reader owns the instance and never registers anything after creation.
const markdown = createCommentMarkdown();

function renderTokens(tokens: CommentMarkdownToken[], multipleLine: boolean): ReactNode {
  return tokens.map((token, index) => {
    const children = token.tokens ? renderTokens(token.tokens, multipleLine) : token.text;
    let rendered: ReactNode;
    switch (token.type) {
      case "paragraph":
        rendered = multipleLine ? <p>{children}</p> : <span>{children}</span>;
        break;
      case "strong":
        rendered = <strong>{children}</strong>;
        break;
      case "em":
        rendered = <em>{children}</em>;
        break;
      case "del":
        rendered = <del>{children}</del>;
        break;
      case "underline":
        rendered = <u>{children}</u>;
        break;
      case "link":
        rendered = /^(?:https?:|mailto:)/i.test(token.href ?? "") ? (
          <a href={token.href} title={token.title ?? undefined} target="_blank" rel="noreferrer">
            {children}
          </a>
        ) : (
          token.raw
        );
        break;
      case "br":
        rendered = <br />;
        break;
      case "space":
        rendered = "\n";
        break;
      case "text":
      case "escape":
        rendered = children;
        break;
      default:
        rendered = token.raw;
    }
    return <Fragment key={index}>{rendered}</Fragment>;
  });
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
      {renderTokens(markdown.lexer(comment), multipleLine)}
    </Typography>
  );
}

export default memo(Comment);
