import pytest
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from tests.factories import ApplicantFactory, ReviewerFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture
def applicant(db):
    return ApplicantFactory()


@pytest.fixture
def reviewer(db):
    return ReviewerFactory()


@pytest.fixture
def client_for(db):
    """Return a factory that builds a token-authenticated client for a user."""

    def _make(user):
        client = APIClient()
        token, _ = Token.objects.get_or_create(user=user)
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return client

    return _make


@pytest.fixture
def applicant_client(client_for, applicant):
    return client_for(applicant)


@pytest.fixture
def reviewer_client(client_for, reviewer):
    return client_for(reviewer)
