import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownText({
  value,
  className = "markdown",
  emptyText = "No description.",
}) {
  const resolvedClassName = className.includes("markdown")
    ? className
    : `markdown ${className}`;

  if (!value || !value.trim()) {
    return <p className={`${resolvedClassName} markdown--muted`}>{emptyText}</p>;
  }
  return (
    <div className={resolvedClassName}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
