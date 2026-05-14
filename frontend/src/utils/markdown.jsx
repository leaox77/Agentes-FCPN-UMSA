import React from "react";

function inlineMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="font-mono text-xs bg-app-card px-1.5 py-0.5 rounded">{part.slice(1, -1)}</code>;
    return part;
  });
}

export function renderMarkdown(text) {
  const lines = text.split("\n");
  const result = [];
  let listBuffer = [];
  let numListBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length > 0) {
      result.push(
        <ul key={`ul-${key}`} className="space-y-1 my-2 pl-2">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex gap-2 items-start leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
    if (numListBuffer.length > 0) {
      result.push(
        <ol key={`ol-${key}`} className="space-y-1 my-2 pl-2">
          {numListBuffer.map((item, i) => (
            <li key={i} className="flex gap-2 items-start leading-relaxed">
              <span className="shrink-0 font-mono text-xs opacity-50 mt-0.5 w-4">{i + 1}.</span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      numListBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const h3 = line.match(/^#{3,}\s+(.+)/);
    if (h3) { flushList(idx); result.push(<p key={idx} className="font-semibold text-sm mt-3 mb-1 opacity-90">{inlineMarkdown(h3[1])}</p>); return; }
    const h2 = line.match(/^#{1,2}\s+(.+)/);
    if (h2) { flushList(idx); result.push(<p key={idx} className="font-bold text-base mt-3 mb-1">{inlineMarkdown(h2[1])}</p>); return; }
    const ul = line.match(/^\s*[-*]\s+(.+)/);
    if (ul) { numListBuffer.length && flushList(idx); listBuffer.push(ul[1]); return; }
    const ol = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (ol) { listBuffer.length && flushList(idx); numListBuffer.push(ol[1]); return; }
    if (line.trim() === "") { flushList(idx); result.push(<div key={idx} className="h-1.5" />); return; }
    flushList(idx);
    result.push(<p key={idx} className="leading-relaxed">{inlineMarkdown(line)}</p>);
  });

  flushList("end");
  return result;
}
