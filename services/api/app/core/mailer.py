"""Outgoing email behind a small interface. Real SMTP/provider adapters arrive with notifications (Stage F)."""

import logging
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr
from functools import lru_cache
from typing import Protocol

log = logging.getLogger("venn.mail")


@dataclass(frozen=True)
class Message:
    to: str
    subject: str
    body: str


class Mailer(Protocol):
    def send(self, message: Message) -> None: ...


@dataclass
class LogMailer:
    """Development adapter: writes the message to the log and keeps it for tests. Never sends anything."""

    sent: list[Message] = field(default_factory=list)

    def send(self, message: Message) -> None:
        self.sent.append(message)
        log.info("email (not sent: development mailer) to=%s subject=%s", message.to, message.subject)


class MailError(Exception):
    """The provider refused or could not be reached. The caller decides what that means for its own work."""


@dataclass
class SmtpMailer:
    host: str
    port: int
    user: str
    password: str
    sender: str
    sender_name: str = "venn"
    tls: bool = True

    def send(self, message: Message) -> None:
        mail = EmailMessage()
        mail["From"] = formataddr((self.sender_name, self.sender))
        mail["To"] = message.to
        mail["Subject"] = " ".join(message.subject.split())[:200]  # one line: a header cannot be split
        mail.set_content(message.body)
        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as s:
                if self.tls:
                    s.starttls(context=ssl.create_default_context())
                if self.user:
                    s.login(self.user, self.password)
                s.send_message(mail)
        except (smtplib.SMTPException, OSError) as e:
            log.error("email failed to=%s: %s", message.to, type(e).__name__)
            raise MailError("The email could not be sent.") from e


@lru_cache
def get_mailer() -> Mailer:
    from app.core.config import get_settings

    c = get_settings()
    if c.smtp_host and c.mail_from and (c.smtp_user or not c.smtp_tls):
        return SmtpMailer(c.smtp_host, c.smtp_port, c.smtp_user, c.smtp_password, c.mail_from, c.mail_from_name, c.smtp_tls)
    return LogMailer()
