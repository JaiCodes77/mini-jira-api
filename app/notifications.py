import os
import re
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Iterable, Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models


MENTION_PATTERN = re.compile(r"(?<!\w)@([A-Za-z0-9_.-]+)")


def extract_mentioned_users(db: Session, body: str) -> list[models.User]:
    usernames = {match.group(1) for match in MENTION_PATTERN.finditer(body or "")}
    if not usernames:
        return []
    return (
        db.query(models.User)
        .filter(models.User.username.in_(sorted(usernames)), models.User.is_active.is_(True))
        .all()
    )


def _send_email(to_email: str, subject: str, body: str) -> bool:
    host = os.getenv("SMTP_HOST")
    from_email = os.getenv("SMTP_FROM")
    if not host or not from_email:
        return False

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    message = EmailMessage()
    message["From"] = from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
        return True
    except Exception:
        return False


def create_notification(
    db: Session,
    *,
    user: models.User,
    bug_id: int | None,
    notification_type: str,
    title: str,
    body: str,
    link: str | None = None,
    metadata_json: dict | None = None,
) -> models.Notification | None:
    if not user.in_app_notifications and not user.email_notifications:
        return None

    notification = models.Notification(
        user_id=user.id,
        bug_id=bug_id,
        notification_type=notification_type,
        title=title,
        body=body,
        link=link,
        metadata_json=metadata_json,
    )
    if user.email_notifications:
        notification.email_sent = _send_email(user.email, title, body)
    db.add(notification)
    return notification


def create_notifications_for_users(
    db: Session,
    users: Sequence[models.User] | Iterable[models.User],
    *,
    bug_id: int | None,
    notification_type: str,
    title: str,
    body: str,
    link: str | None = None,
    metadata_json: dict | None = None,
    exclude_user_ids: set[int] | None = None,
) -> list[models.Notification]:
    notifications: list[models.Notification] = []
    seen: set[int] = set(exclude_user_ids or set())

    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        notification = create_notification(
            db,
            user=user,
            bug_id=bug_id,
            notification_type=notification_type,
            title=title,
            body=body,
            link=link,
            metadata_json=metadata_json,
        )
        if notification is not None:
            notifications.append(notification)

    return notifications


def get_bug_notification_recipients(
    bug: models.Bug,
    *,
    include_watchers: bool = True,
) -> list[models.User]:
    recipients: list[models.User] = []
    if bug.assignee is not None:
        recipients.append(bug.assignee)
    if bug.reporter is not None:
        recipients.append(bug.reporter)
    if include_watchers:
        recipients.extend(bug.watchers)
    return recipients


def sync_due_notifications_for_user(db: Session, user: models.User) -> None:
    now = datetime.now(timezone.utc)
    bugs = (
        db.query(models.Bug)
        .outerjoin(models.bug_watchers, models.bug_watchers.c.bug_id == models.Bug.id)
        .filter(
            or_(
                models.Bug.assignee_id == user.id,
                models.Bug.reporter_id == user.id,
                models.bug_watchers.c.user_id == user.id,
            )
        )
        .distinct()
        .all()
    )

    for bug in bugs:
        if bug.reminder_at and bug.reminder_at <= now:
            title = f"Reminder for #{bug.id}"
            exists = (
                db.query(models.Notification)
                .filter(
                    models.Notification.user_id == user.id,
                    models.Notification.bug_id == bug.id,
                    models.Notification.notification_type == "reminder",
                    models.Notification.title == title,
                )
                .first()
            )
            if not exists:
                create_notification(
                    db,
                    user=user,
                    bug_id=bug.id,
                    notification_type="reminder",
                    title=title,
                    body=f"{bug.title} has reached its reminder time.",
                    link=f"/dashboard/bugs/{bug.id}",
                    metadata_json={"trigger": "reminder_at"},
                )

        if bug.due_at and bug.due_at <= now:
            title = f"Due date reached for #{bug.id}"
            exists = (
                db.query(models.Notification)
                .filter(
                    models.Notification.user_id == user.id,
                    models.Notification.bug_id == bug.id,
                    models.Notification.notification_type == "due_date",
                    models.Notification.title == title,
                )
                .first()
            )
            if not exists:
                create_notification(
                    db,
                    user=user,
                    bug_id=bug.id,
                    notification_type="due_date",
                    title=title,
                    body=f"{bug.title} is now due.",
                    link=f"/dashboard/bugs/{bug.id}",
                    metadata_json={"trigger": "due_at"},
                )
