class ArchiveError(Exception):
    """An upstream response cannot be safely used."""

    def __init__(self, message: str, *, code="archive_error", retry_after: int | None = None):
        super().__init__(message)
        self.code = code
        self.retry_after = retry_after


class QueueFull(Exception):
    pass
