import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { Avatar } from "./components/IssueGlyphs";
import { PencilIcon, TrashIcon } from "./components/Icons";
import { formatDate, formatRelative } from "./issueConstants";
import MarkdownText from "./MarkdownText";
import { toast } from "./Toasts";

const PAGE_SIZE = 20;

const submitOnModEnter = (handler) => (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    handler();
  }
};

export default function CommentThread({ bugId, auth, fetchWithAuth, mentionableUsers = [], onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchComments = useCallback(
    async (nextOffset = 0) => {
      try {
        const response = await fetchWithAuth(
          `${API_BASE_URL}/bugs/${bugId}/comments?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        );
        if (!response.ok) throw new Error("Could not load comments.");
        const data = await response.json();
        setComments(data.items);
        setTotal(data.total);
        setOffset(nextOffset);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [bugId, fetchWithAuth],
  );

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    onCountChange?.(total);
  }, [onCountChange, total]);

  const submit = async () => {
    if (!body.trim() || submitting) return;
    try {
      setSubmitting(true);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not post the comment.");
      }
      setBody("");
      await fetchComments(0);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not delete the comment.");
      }
      await fetchComments(offset);
      toast("Comment deleted.");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const saveEdit = async () => {
    if (!editBody.trim()) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Could not update the comment.");
      }
      setEditingId(null);
      setEditBody("");
      await fetchComments(offset);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const mentionHint = mentionableUsers
    .filter((user) => user.id !== auth?.user_id)
    .slice(0, 3)
    .map((user) => `@${user.username}`)
    .join(" ");

  return (
    <div className="comments">
      {auth?.token && (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Avatar name={auth.username} />
          <div className="composer__box">
            <label className="visually-hidden" htmlFor={`comment-${bugId}`}>
              Write a comment
            </label>
            <textarea
              id={`comment-${bugId}`}
              className="composer__input"
              rows={body ? 3 : 1}
              placeholder="Leave a comment"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={submitOnModEnter(() => void submit())}
            />
            <AnimatePresence initial={false}>
              {body && (
                <motion.div
                  key="bar"
                  className="composer__bar"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <span className="composer__hint">
                    {mentionHint ? `Mention ${mentionHint}` : "Markdown works"}
                  </span>
                  <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !body.trim()}>
                    {submitting ? "Posting…" : "Comment"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      )}

      {loading ? (
        <div className="comment comment--skeleton">
          <span className="shimmer shimmer--round" />
          <span className="shimmer" style={{ width: "70%" }} />
        </div>
      ) : comments.length === 0 ? (
        <p className="section-empty">No comments yet.</p>
      ) : (
        <ul className="comment-list">
          <AnimatePresence initial={false}>
            {comments.map((comment) => {
              const isAuthor = comment.author_id === auth?.user_id;
              const isEditing = editingId === comment.id;
              return (
                <motion.li
                  key={comment.id}
                  layout="position"
                  className="comment"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <Avatar name={comment.author.username} />
                  <div className="comment__body">
                    <div className="comment__head">
                      <span className="comment__author">{comment.author.username}</span>
                      <time className="comment__time" dateTime={comment.created_at} title={formatDate(comment.created_at)}>
                        {formatRelative(comment.created_at)}
                      </time>
                      {isAuthor && !isEditing && (
                        <span className="comment__actions">
                          <button
                            type="button"
                            className="icon-button icon-button--xs"
                            aria-label="Edit comment"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditBody(comment.body);
                            }}
                          >
                            <PencilIcon size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-button--xs icon-button--danger"
                            aria-label="Delete comment"
                            onClick={() => void remove(comment.id)}
                          >
                            <TrashIcon size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="comment__edit">
                        <textarea
                          className="textarea"
                          rows={3}
                          aria-label="Edit comment"
                          value={editBody}
                          onChange={(event) => setEditBody(event.target.value)}
                          onKeyDown={submitOnModEnter(() => void saveEdit())}
                          autoFocus
                        />
                        <div className="comment__edit-actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditBody("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => void saveEdit()}
                            disabled={!editBody.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <MarkdownText value={comment.body} />
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="comment-pager">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={offset === 0}
            onClick={() => void fetchComments(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </button>
          <span>
            {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => void fetchComments(offset + PAGE_SIZE)}
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}
