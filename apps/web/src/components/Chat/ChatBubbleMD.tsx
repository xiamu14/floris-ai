import { Card } from "@heroui/react";
import { marked } from "marked";

function renderMarkdown(markdown: string) {
  const html = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  });

  return html.replaceAll("<a ", '<a target="_blank" rel="noreferrer" ');
}

export default function ChatBubbleMD({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const html = renderMarkdown(markdown);

  return (
    <Card
      className={`items-stretch border border-solid border-[#e9e9e9] shadow-none ${className ?? ""}`.trim()}
    >
      <Card.Content className="">
        <div
          className="prose prose-sm max-w-none text-black prose-headings:mt-0 prose-headings:mb-2 prose-p:my-0 prose-blockquote:my-0 prose-blockquote:border-l-[#e9e9e9] prose-blockquote:text-black/70 prose-ul:my-0 prose-ol:my-0 prose-li:my-1 prose-pre:my-0 prose-pre:rounded-2xl prose-pre:bg-white prose-pre:px-4 prose-pre:py-3 prose-code:rounded prose-code:bg-white prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-black prose-a:text-(--accent) prose-strong:text-black [&_pre_code]:bg-transparent [&_pre_code]:p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card.Content>
    </Card>
  );
}
