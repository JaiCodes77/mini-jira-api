import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function CommentThread({ bugId, auth, fetchWithAuth }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/bugs/${bugId}/comments?limit=50&offset=0`);
      if (!response.ok) throw new Error("Failed to load comments.");
      const data = await response.json();
      setComments(data.items);
    } catch (err) {
      toast(err.message || "Could not load comments.", "error");
    } finally {
      setLoading(false);
    }
  }, [bugId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });

      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to add comment.");
      }

      setBody("");
      await fetchComments();
      toast("Comment added.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to delete comment.");
      }

      await fetchComments();
      toast("Comment deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const currentUserId = auth?.user_id;

  return (
    <div className="comment-thread">
      <span className="comment-thread__title">Comments</span>

      {loading ? (
        <p className="comment-empty">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="comment-empty">No comments yet.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <div className="comment-item__header">
                <span className="comment-item__author">{comment.author_username}</span>
                <span className="comment-item__date">{formatDate(comment.created_at)}</span>
                {comment.author_id === currentUserId && (
                  <button
                    type="button"
                    className="comment-item__delete"
                    onClick={() => void handleDelete(comment.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="comment-item__body">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {auth?.token && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            className="comment-form__input"
            type="text"
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="submit"
            className="comment-form__submit"
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </form>
      )}
    </div>
  );
}
