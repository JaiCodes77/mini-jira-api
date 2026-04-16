import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownText({
  value,
  className = "markdown",
  emptyText = "No description.",
}) {
  if (!value || !value.trim()) {
    return <p className={`${className} markdown--muted`}>{emptyText}</p>;
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
