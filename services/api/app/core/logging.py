import json
import logging
import sys


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {"time": self.formatTime(record), "level": record.levelname,
                "logger": record.name, "message": record.getMessage()}
        for k in ("request_id", "method", "path", "status", "ms"):
            if hasattr(record, k):
                data[k] = getattr(record, k)
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data)


def setup_logging(level: str) -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JsonFormatter())
    logging.basicConfig(level=level, handlers=[h], force=True)
