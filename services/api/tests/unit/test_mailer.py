import smtplib

import pytest

from app.core.config import get_settings
from app.core.mailer import LogMailer, MailError, Message, SmtpMailer, get_mailer


class FakeSmtp:
    log: list[tuple[str, object]] = []
    fail = False

    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.log.append(("connect", (host, port)))

    def __enter__(self) -> "FakeSmtp":
        return self

    def __exit__(self, *a: object) -> None:
        return None

    def starttls(self, context: object) -> None:
        self.log.append(("tls", None))

    def login(self, user: str, password: str) -> None:
        if self.fail:
            raise smtplib.SMTPAuthenticationError(535, b"bad")
        self.log.append(("login", user))

    def send_message(self, m: object) -> None:
        self.log.append(("send", (m["To"], m["From"], m["Subject"])))  # type: ignore[index]


def test_smtp_mailer_uses_tls_logs_in_and_sends(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeSmtp.log, FakeSmtp.fail = [], False
    monkeypatch.setattr(smtplib, "SMTP", FakeSmtp)
    SmtpMailer("smtp.example", 587, "u", "p", "from@example.com", "venn").send(Message("to@example.com", "Hello\nthere", "body"))
    assert [k for k, _ in FakeSmtp.log] == ["connect", "tls", "login", "send"]
    assert FakeSmtp.log[-1][1] == ("to@example.com", "venn <from@example.com>", "Hello there")  # a header cannot be split across lines


def test_provider_failure_becomes_a_mail_error_without_leaking_details(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeSmtp.log, FakeSmtp.fail = [], True
    monkeypatch.setattr(smtplib, "SMTP", FakeSmtp)
    with pytest.raises(MailError) as e:
        SmtpMailer("smtp.example", 587, "u", "secret-password", "f@example.com").send(Message("t@example.com", "s", "b"))
    assert "secret-password" not in str(e.value)


def test_mailer_choice_follows_the_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    for k in ("HOST", "USER", "PASSWORD", "MAIL_FROM"):
        monkeypatch.delenv(f"VENN_SMTP_{k}" if k != "MAIL_FROM" else "VENN_MAIL_FROM", raising=False)
    get_mailer.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("VENN_SMTP_HOST", "")
    assert isinstance(get_mailer(), LogMailer)
    monkeypatch.setenv("VENN_SMTP_HOST", "smtp.example")
    monkeypatch.setenv("VENN_SMTP_USER", "u")
    monkeypatch.setenv("VENN_SMTP_PASSWORD", "p")
    monkeypatch.setenv("VENN_MAIL_FROM", "f@example.com")
    get_mailer.cache_clear()
    get_settings.cache_clear()
    assert isinstance(get_mailer(), SmtpMailer)
    get_mailer.cache_clear()
    get_settings.cache_clear()
