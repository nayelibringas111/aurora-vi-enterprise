import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-with-more-than-32-characters"
os.environ["AUTO_SEED"] = "true"
os.environ["SEED_DEMO_DATA"] = "true"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, email, pwd):
    r = client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin@auroravi.com", "Admin123!")


@pytest.fixture(scope="session")
def vendedor(client):
    return _login(client, "vendedor@auroravi.com", "Vendedor123!")


@pytest.fixture(scope="session")
def almacen(client):
    return _login(client, "almacen@auroravi.com", "Almacen123!")
