from typing import Protocol

from spherex.models import JobRequest, Observation, SearchResult, SkySearch


class Provider(Protocol):
    async def search(self, query: SkySearch) -> SearchResult: ...

    async def fetch(self, observation: Observation, request: JobRequest) -> bytes: ...
