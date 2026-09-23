import { Route } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Рендер санитизированного HTML поста в React-элементы: упоминания персонажей
 * (`<span data-type="mention" data-id>`) становятся ссылками. Без хуков, поэтому
 * работает и в серверных, и в клиентских компонентах.
 */
export function renderCommentHtml(html: string, bookId: string) {
  const tokens = html.match(/<\/?[^>]+>|[^<]+/g) ?? [];
  const root: ReactNode[] = [];
  const stack: { tag: string; attrs: string; children: ReactNode[] }[] = [
    { tag: "root", attrs: "", children: root },
  ];
  let key = 0;

  for (const token of tokens) {
    if (token.startsWith("</")) {
      const frame = stack.pop();
      const parent = stack[stack.length - 1];
      if (!frame || !parent || frame.tag === "root") continue;
      parent.children.push(renderTag(frame, bookId, key++));
      continue;
    }

    if (!token.startsWith("<")) {
      stack[stack.length - 1]?.children.push(decodeText(token));
      continue;
    }

    const tag = token.match(/^<([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (tag === "br" || tag === "hr") {
      stack[stack.length - 1]?.children.push(
        tag === "br" ? <br key={key++} /> : <hr key={key++} />,
      );
      continue;
    }
    stack.push({ tag, attrs: token, children: [] });
  }

  return root;
}

function renderTag(
  frame: { tag: string; attrs: string; children: ReactNode[] },
  bookId: string,
  key: number,
) {
  const children = frame.children;

  if (frame.tag === "span" && /data-type="mention"/i.test(frame.attrs)) {
    const characterId = attrValue(frame.attrs, "data-id");
    if (!characterId) return <Fragment key={key}>{children}</Fragment>;

    return (
      <Link
        key={key}
        href={
          `/books/${bookId}/${characterId}` as Route<"/books/[bookId]/[characterId]">
        }
        className="rounded bg-primary/15 px-1 text-primary hover:underline"
      >
        {children}
      </Link>
    );
  }

  switch (frame.tag) {
    case "blockquote":
      return (
        <blockquote key={key} className="my-2 border-l-2 border-border pl-3">
          {children}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc pl-5">
          {children}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal pl-5">
          {children}
        </ol>
      );
    case "li":
      return <li key={key}>{children}</li>;
    case "strong":
    case "b":
      return <strong key={key}>{children}</strong>;
    case "em":
    case "i":
      return <em key={key}>{children}</em>;
    case "s":
    case "strike":
      return <s key={key}>{children}</s>;
    case "code":
      return <code key={key}>{children}</code>;
    case "pre":
      return <pre key={key}>{children}</pre>;
    case "h1":
      return <h1 key={key}>{children}</h1>;
    case "h2":
      return <h2 key={key}>{children}</h2>;
    case "h3":
      return <h3 key={key}>{children}</h3>;
    default:
      return <p key={key}>{children}</p>;
  }
}

function attrValue(rawAttrs: string, name: string) {
  const match = rawAttrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match?.[1] ?? "";
}

function decodeText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}
