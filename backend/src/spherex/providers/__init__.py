from spherex.config import Settings
from spherex.providers.demo import DemoProvider
from spherex.providers.irsa import IRSAProvider


def make_provider(settings: Settings):
    return DemoProvider() if settings.provider == "demo" else IRSAProvider(settings)
