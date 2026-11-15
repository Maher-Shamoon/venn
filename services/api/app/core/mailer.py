"""Outgoing email behind a small interface. Real SMTP/provider adapters arrive with notifications (Stage F)."""

import logging
from dataclasses import dataclass, field
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


@lru_cache
def get_mailer() -> Mailer:
    return LogMailer()
