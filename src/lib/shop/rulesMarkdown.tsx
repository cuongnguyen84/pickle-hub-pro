// Display-layer rendering for the seller rules document.
//
// The STORED body is frozen byte-for-byte by its content hash, so nothing here
// may touch what the server keeps or what an acceptance signs — this maps the
// markdown to readable JSX at render time only. React's default escaping does
// the sanitising; there is no dangerouslySetInnerHTML anywhere in this file.
//
// ponytail: a ~70-line renderer for the handful of constructs the document
// actually uses (headings, bold, lists, blockquotes, rules). If a future
// version of the document needs real markdown, swap this for a library and
// pay the bundle cost then.
import type { ReactNode } from "react";

/** The leading `| … |` metadata table is the approval-desk's bookkeeping
 *  (status, document key, review flags) — internal, not seller-facing. It is
 *  dropped from DISPLAY only; the signed body still contains it. */
export function stripInternalHeader(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let inLeadingTable = true;
  for (const line of lines) {
    if (inLeadingTable && (line.startsWith("|") || line.trim() === "")) {
      if (line.startsWith("|")) continue;
      out.push(line);
      continue;
    }
    inLeadingTable = false;
    out.push(line);
  }
  return out.join("\n");
}

/** `**bold**` only — the single inline construct the document uses. */
const inline = (text: string, key: number): ReactNode => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={`${key}-${i}`}>{p}</strong> : p));
};

export function renderRulesMarkdown(body: string): ReactNode[] {
  const lines = stripInternalHeader(body).split("\n");
  const out: ReactNode[] = [];
  let buf: string[] = [];
  let mode: "p" | "quote" | "ul" | "ol" = "p";

  const flush = () => {
    if (buf.length === 0) return;
    const key = out.length;
    if (mode === "quote") {
      out.push(<blockquote key={key}>{buf.map((l, i) => <p key={i}>{inline(l, i)}</p>)}</blockquote>);
    } else if (mode === "ul" || mode === "ol") {
      const items = buf.map((l, i) => <li key={i}>{inline(l, i)}</li>);
      out.push(mode === "ul" ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>);
    } else {
      out.push(<p key={key}>{inline(buf.join(" "), key)}</p>);
    }
    buf = [];
    mode = "p";
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3}) +(.*)$/);
    if (h) {
      flush();
      const key = out.length;
      // The card already carries the document title as its own heading, so the
      // body's # starts one level down.
      if (h[1] === "#") out.push(<h3 key={key}>{inline(h[2], key)}</h3>);
      else if (h[1] === "##") out.push(<h4 key={key}>{inline(h[2], key)}</h4>);
      else out.push(<h5 key={key}>{inline(h[2], key)}</h5>);
    } else if (/^---+$/.test(line)) {
      flush();
      out.push(<hr key={out.length} />);
    } else if (line.startsWith("> ") || line === ">") {
      if (mode !== "quote") flush();
      mode = "quote";
      if (line !== ">") buf.push(line.slice(2));
      else if (buf.length) { /* blank quote line = paragraph break inside quote */ }
    } else if (/^[-*] +/.test(line)) {
      if (mode !== "ul") flush();
      mode = "ul";
      buf.push(line.replace(/^[-*] +/, ""));
    } else if (/^\d+[.)] +/.test(line)) {
      if (mode !== "ol") flush();
      mode = "ol";
      buf.push(line.replace(/^\d+[.)] +/, ""));
    } else if (line.trim() === "") {
      flush();
    } else if (line.startsWith("|")) {
      // A table further down the document: render its cells as a plain list
      // rather than raw pipes.
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c && !/^[-: ]+$/.test(c));
      if (cells.length) {
        if (mode !== "ul") flush();
        mode = "ul";
        buf.push(cells.join(" — "));
      }
    } else {
      if (mode !== "p") flush();
      buf.push(line);
    }
  }
  flush();
  return out;
}
