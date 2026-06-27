"""API-level tests: workflow endpoints, authorization, error shapes, audit log.

Numbered comments map to the required test cases in the brief.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from applications.models import AuditLog
from applications.workflow import Status
from tests.factories import ApplicantFactory, ApplicationFactory, ReviewerFactory

pytestmark = pytest.mark.django_db

APPLICATIONS_URL = "/api/applications/"


def detail_url(app_id):
    return f"{APPLICATIONS_URL}{app_id}/"


def action_url(app_id, action):
    return f"{APPLICATIONS_URL}{app_id}/{action}/"


# 1. Applicant can create a DRAFT.
def test_applicant_can_create_draft(applicant_client, applicant):
    payload = {"title": "New laptop", "category": "FINANCE", "amount": "999.99"}
    response = applicant_client.post(APPLICATIONS_URL, payload, format="json")
    assert response.status_code == 201
    assert response.data["status"] == Status.DRAFT
    assert response.data["owner"] == applicant.id


def test_create_requires_title_and_category(applicant_client):
    response = applicant_client.post(APPLICATIONS_URL, {"description": "x"}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "title" in response.data["error"]["details"]
    assert "category" in response.data["error"]["details"]


def test_create_rejects_non_numeric_amount(applicant_client):
    response = applicant_client.post(
        APPLICATIONS_URL,
        {"title": "Bad amount", "category": "FINANCE", "amount": "qwqwewere"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "amount" in response.data["error"]["details"]


def test_applicant_can_create_draft_with_attachment(applicant_client):
    attachment = SimpleUploadedFile(
        "quote.pdf",
        b"%PDF-1.4 test file",
        content_type="application/pdf",
    )
    response = applicant_client.post(
        APPLICATIONS_URL,
        {
            "title": "Attached request",
            "category": "FINANCE",
            "amount": "500.00",
            "attachment": attachment,
        },
        format="multipart",
    )
    assert response.status_code == 201
    assert response.data["attachment_name"].endswith("quote.pdf")
    assert response.data["attachment_url"]


def test_attachment_rejects_unsupported_file_type(applicant_client):
    attachment = SimpleUploadedFile(
        "script.exe",
        b"nope",
        content_type="application/x-msdownload",
    )
    response = applicant_client.post(
        APPLICATIONS_URL,
        {
            "title": "Bad attachment",
            "category": "OTHER",
            "attachment": attachment,
        },
        format="multipart",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "attachment" in response.data["error"]["details"]


def test_reviewer_cannot_create(reviewer_client):
    payload = {"title": "Nope", "category": "OTHER"}
    response = reviewer_client.post(APPLICATIONS_URL, payload, format="json")
    assert response.status_code == 403


# 2. Applicant can edit their own DRAFT.
def test_applicant_can_edit_own_draft(applicant_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.DRAFT)
    response = applicant_client.patch(
        detail_url(app.id), {"title": "Edited title"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["title"] == "Edited title"


def test_returned_application_returns_to_draft_and_is_editable(
    reviewer_client, applicant_client, applicant
):
    """Return-for-changes sends the application back to DRAFT (spec diagram), where
    the owner can edit and resubmit it."""
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    returned = reviewer_client.post(
        action_url(app.id, "return"), {"comment": "Please revise"}, format="json"
    )
    assert returned.status_code == 200
    assert returned.data["status"] == Status.DRAFT
    # Back in DRAFT, the owner can edit again.
    edit = applicant_client.patch(
        detail_url(app.id), {"description": "addressed feedback"}, format="json"
    )
    assert edit.status_code == 200


def test_edit_rejects_non_numeric_amount(applicant_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.DRAFT)
    response = applicant_client.patch(
        detail_url(app.id), {"amount": "qwqwewere"}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "amount" in response.data["error"]["details"]


def test_editing_draft_records_field_changes(applicant_client, applicant):
    """A draft edit is recorded in the activity log as a per-field diff."""
    app = ApplicationFactory(
        owner=applicant, status=Status.DRAFT, title="Old title", amount="100.00"
    )
    response = applicant_client.patch(
        detail_url(app.id), {"title": "New title", "amount": "250.00"}, format="json"
    )
    assert response.status_code == 200
    log = AuditLog.objects.filter(application=app).latest("created_at")
    assert log.old_status == Status.DRAFT and log.new_status == Status.DRAFT
    assert log.changes["title"] == ["Old title", "New title"]
    assert log.changes["amount"] == ["100.00", "250.00"]


# 3. Applicant cannot edit once the application has left DRAFT.
def test_applicant_cannot_edit_after_submitted(applicant_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.SUBMITTED)
    response = applicant_client.patch(
        detail_url(app.id), {"title": "Sneaky edit"}, format="json"
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "edit_not_allowed"


def test_applicant_cannot_edit_someone_elses_draft(applicant_client):
    other = ApplicantFactory()
    app = ApplicationFactory(owner=other, status=Status.DRAFT)
    # Not in the requester's queryset -> 404 (existence is not leaked).
    response = applicant_client.patch(detail_url(app.id), {"title": "x"}, format="json")
    assert response.status_code == 404


# 4. Applicant can submit their own DRAFT.
def test_applicant_can_submit_own_draft(applicant_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.DRAFT)
    response = applicant_client.post(action_url(app.id, "submit"))
    assert response.status_code == 200
    assert response.data["status"] == Status.SUBMITTED


# 5. Reviewer can move SUBMITTED -> UNDER_REVIEW.
def test_reviewer_can_start_review(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.SUBMITTED)
    response = reviewer_client.post(action_url(app.id, "start-review"))
    assert response.status_code == 200
    assert response.data["status"] == Status.UNDER_REVIEW


# 6. Reviewer can approve a valid (UNDER_REVIEW) application.
def test_reviewer_can_approve(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    response = reviewer_client.post(action_url(app.id, "approve"))
    assert response.status_code == 200
    assert response.data["status"] == Status.APPROVED


# 7. Reject requires a comment.
def test_reject_requires_comment(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    no_comment = reviewer_client.post(action_url(app.id, "reject"), {}, format="json")
    assert no_comment.status_code == 400
    assert no_comment.data["error"]["code"] == "comment_required"

    ok = reviewer_client.post(
        action_url(app.id, "reject"), {"comment": "Not eligible"}, format="json"
    )
    assert ok.status_code == 200
    assert ok.data["status"] == Status.REJECTED


# 8. Return requires a comment.
def test_return_requires_comment(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    no_comment = reviewer_client.post(action_url(app.id, "return"), {}, format="json")
    assert no_comment.status_code == 400
    assert no_comment.data["error"]["code"] == "comment_required"

    ok = reviewer_client.post(
        action_url(app.id, "return"), {"comment": "Please add detail"}, format="json"
    )
    assert ok.status_code == 200
    assert ok.data["status"] == Status.DRAFT


# 9. Illegal transition is rejected (approve before starting review).
def test_illegal_transition_returns_409(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.SUBMITTED)
    response = reviewer_client.post(action_url(app.id, "approve"))
    assert response.status_code == 409
    assert response.data["error"]["code"] == "transition_not_allowed"


# 10. Applicant cannot approve their own application via the API (must be 403).
def test_applicant_cannot_approve_own_application(applicant_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    response = applicant_client.post(action_url(app.id, "approve"))
    assert response.status_code == 403
    assert app.audit_logs.count() == 0  # nothing was written


# 11. An audit log entry is created for every successful transition.
def test_audit_log_records_every_transition(applicant_client, reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.DRAFT)

    applicant_client.post(action_url(app.id, "submit"))
    reviewer_client.post(action_url(app.id, "start-review"))
    reviewer_client.post(action_url(app.id, "approve"))

    logs = list(AuditLog.objects.filter(application=app).order_by("created_at"))
    assert len(logs) == 3
    assert [(log.old_status, log.new_status) for log in logs] == [
        (Status.DRAFT, Status.SUBMITTED),
        (Status.SUBMITTED, Status.UNDER_REVIEW),
        (Status.UNDER_REVIEW, Status.APPROVED),
    ]
    assert logs[0].actor == applicant


def test_audit_log_endpoint_returns_trail(reviewer_client, applicant):
    app = ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)
    reviewer_client.post(
        action_url(app.id, "reject"), {"comment": "Out of budget"}, format="json"
    )
    response = reviewer_client.get(action_url(app.id, "audit-logs"))
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["comment"] == "Out of budget"


# --- Auth / visibility extras ---------------------------------------------
def test_unauthenticated_requests_are_rejected(api_client):
    response = api_client.get(APPLICATIONS_URL)
    assert response.status_code == 401


def test_applicant_only_sees_own_applications(applicant_client, applicant):
    ApplicationFactory(owner=applicant, status=Status.DRAFT)
    ApplicationFactory(owner=ApplicantFactory(), status=Status.SUBMITTED)
    response = applicant_client.get(APPLICATIONS_URL)
    assert response.status_code == 200
    assert len(response.data) == 1


def test_reviewer_does_not_see_drafts_and_can_filter(reviewer_client, applicant):
    ApplicationFactory(owner=applicant, status=Status.DRAFT)
    ApplicationFactory(owner=applicant, status=Status.SUBMITTED)
    ApplicationFactory(owner=applicant, status=Status.UNDER_REVIEW)

    all_visible = reviewer_client.get(APPLICATIONS_URL)
    assert len(all_visible.data) == 2  # draft excluded

    filtered = reviewer_client.get(APPLICATIONS_URL, {"status": Status.SUBMITTED})
    assert len(filtered.data) == 1


def test_login_returns_token(api_client, applicant):
    response = api_client.post(
        "/api/auth/login/",
        {"email": applicant.email, "password": "password123"},
        format="json",
    )
    assert response.status_code == 200
    assert "token" in response.data
    assert response.data["user"]["role"] == "APPLICANT"


def test_login_with_bad_password_fails(api_client, applicant):
    response = api_client.post(
        "/api/auth/login/",
        {"email": applicant.email, "password": "wrong"},
        format="json",
    )
    assert response.status_code == 400
