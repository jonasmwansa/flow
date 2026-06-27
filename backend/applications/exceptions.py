"""Translate workflow rule violations and DRF errors into one structured shape.

Every error response from the API looks like:

    {"error": {"code": "transition_not_allowed",
               "message": "Cannot 'approve' an application in status 'SUBMITTED'.",
               "details": { ... optional, e.g. field-level validation errors ... }}}
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from . import workflow

# Map each workflow error to an HTTP status + stable machine-readable code.
WORKFLOW_ERROR_MAP = {
    workflow.TransitionForbidden: (status.HTTP_403_FORBIDDEN, "forbidden"),
    workflow.TransitionNotAllowed: (status.HTTP_409_CONFLICT, "transition_not_allowed"),
    workflow.CommentRequired: (status.HTTP_400_BAD_REQUEST, "comment_required"),
    workflow.UnknownAction: (status.HTTP_400_BAD_REQUEST, "unknown_action"),
}


class EditNotAllowed(APIException):
    """Raised when an owner tries to edit an application in a non-editable state."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This application can no longer be edited."
    default_code = "edit_not_allowed"


def _error_body(code, message, details=None):
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def structured_exception_handler(exc, context):
    # 1) Workflow rule violations raised from the service layer.
    if isinstance(exc, workflow.WorkflowError):
        for error_type, (http_status, code) in WORKFLOW_ERROR_MAP.items():
            if isinstance(exc, error_type):
                return Response(_error_body(code, str(exc)), status=http_status)
        return Response(
            _error_body("workflow_error", str(exc)),
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 2) Everything DRF already understands (validation, auth, 404, ...).
    response = drf_exception_handler(exc, context)
    if response is None:
        return None  # Unhandled -> let Django produce a 500.

    code = getattr(exc, "default_code", "error")
    detail = response.data

    # Field-level validation errors come back as a dict; surface them as details.
    if isinstance(detail, dict) and "detail" not in detail:
        response.data = _error_body("validation_error", "Validation failed.", details=detail)
    else:
        message = detail.get("detail") if isinstance(detail, dict) else detail
        if isinstance(message, list):
            message = message[0]
        response.data = _error_body(code, str(message))

    return response
