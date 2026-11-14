class ArchiveError(Exception):
    """An upstream response cannot be safely used."""


class QueueFull(Exception):
    pass
