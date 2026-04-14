import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownText({ value, className = "", emptyText = "No content yet." }) {
  if (!value || !value.trim()) {
    return <p className={className}>{emptyText}</p>;
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
