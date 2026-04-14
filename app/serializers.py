from app import models, schemas


def serialize_bug_link(link: models.BugLink, *, direction: str) -> schemas.BugLinkResponse:
    related_bug = link.target_bug if direction == "outgoing" else link.source_bug
    return schemas.BugLinkResponse(
        id=link.id,
        link_type=link.link_type,
        direction=direction,
        bug=schemas.BugReference.model_validate(related_bug),
        created_at=link.created_at,
    )


def serialize_attachment(attachment: models.Attachment) -> schemas.AttachmentResponse:
    return schemas.AttachmentResponse(
        id=attachment.id,
        original_name=attachment.original_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        created_at=attachment.created_at,
        uploaded_by=(
            schemas.UserSummary.model_validate(attachment.uploader)
            if attachment.uploader is not None
            else None
        ),
        download_url=f"/bugs/{attachment.bug_id}/attachments/{attachment.id}/download",
    )


def serialize_activity(event: models.ActivityEvent) -> schemas.ActivityEventResponse:
    return schemas.ActivityEventResponse(
        id=event.id,
        bug_id=event.bug_id,
        event_type=event.event_type,
        summary=event.summary,
        metadata_json=event.metadata_json,
        actor=schemas.UserSummary.model_validate(event.actor) if event.actor is not None else None,
        created_at=event.created_at,
    )


def serialize_notification(notification: models.Notification) -> schemas.NotificationResponse:
    return schemas.NotificationResponse(
        id=notification.id,
        bug_id=notification.bug_id,
        notification_type=notification.notification_type,
        title=notification.title,
        body=notification.body,
        link=notification.link,
        is_read=notification.is_read,
        email_sent=notification.email_sent,
        metadata_json=notification.metadata_json,
        created_at=notification.created_at,
    )


def serialize_comment(comment: models.Comment) -> schemas.CommentResponse:
    return schemas.CommentResponse(
        id=comment.id,
        body=comment.body,
        bug_id=comment.bug_id,
        author_id=comment.author_id,
        author=schemas.UserSummary.model_validate(comment.author),
        mentioned_users=[
            schemas.UserSummary.model_validate(user)
            for user in comment.mentions
        ],
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def serialize_bug(bug: models.Bug) -> schemas.BugResponse:
    return schemas.BugResponse.model_validate(bug)


def serialize_bug_detail(bug: models.Bug) -> schemas.BugDetailResponse:
    base = serialize_bug(bug).model_dump()
    return schemas.BugDetailResponse(
        **base,
        subtasks=[schemas.BugReference.model_validate(item) for item in bug.subtasks],
        watchers=[schemas.UserSummary.model_validate(user) for user in bug.watchers],
        links=[
            serialize_bug_link(link, direction="outgoing")
            for link in bug.links_outgoing
        ]
        + [
            serialize_bug_link(link, direction="incoming")
            for link in bug.links_incoming
        ],
        attachments=[serialize_attachment(item) for item in bug.attachments],
        watch_count=len(bug.watchers),
    )
