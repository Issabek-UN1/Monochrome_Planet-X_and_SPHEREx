import pytest
from fastapi.testclient import TestClient

from spherex.api import create_app
from spherex.config import Settings


@pytest.fixture
def settings(tmp_path):
    return Settings(provider="demo", data_dir=tmp_path)


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def observations(client):
    response = client.get("/api/v1/observations?ra=10&dec=20")
    assert response.status_code == 200
    return response.json()["observations"]
