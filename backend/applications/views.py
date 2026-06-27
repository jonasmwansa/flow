from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import workflow
from .exceptions import EditNotAllowed
from .models import Application, AuditLog
from .permissions import IsApplicant
from .serializers import (
    ApplicationDetailSerializer,
    ApplicationSerializer,
    AuditLogSerializer,
)

# Fields whose edits are recorded (as a per-field diff) in the activity log.
TRACKED_FIELDS = ("title", "category", "description", "amount", "attachment")


def _display_value(field, value):
    """A JSON-serializable, human-readable rendering of a tracked field value."""
    if field == "attachment":
        return value.name.rsplit("/", 1)[-1] if value else ""
    if value in (None, ""):
        return ""
    return str(value)


class ApplicationViewSet(viewsets.ModelViewSet):
    """CRUD for applications plus the workflow transition endpoints.

    Visibility:
      * Applicants see only their own applications (any status).
      * Reviewers see every application except other people's drafts.
    Both lists accept ``?status=`` to filter.

    All status changes go through ``_perform_transition`` -> ``workflow`` so the
    rules live in exactly one place and every change is audited atomically.
    """

    # No PUT (edits are partial) and no DELETE in this scope.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Application.objects.select_related("owner").prefetch_related(
            "audit_logs__actor"
        )
        if user.is_reviewer:
            qs = qs.exclude(status=workflow.Status.DRAFT)
        else:
            qs = qs.filter(owner=user)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ApplicationDetailSerializer
        return ApplicationSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsApplicant()]
        return super().get_permissions()

    # --- Create / edit -----------------------------------------------------
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status=workflow.Status.DRAFT)

    def update(self, request, *args, **kwargs):
        """Edit an application. Owner-only, and only while DRAFT.

        Records the per-field changes in the activity log so the detail page
        shows a draft's revision history alongside its status transitions.
        """
        application = self.get_object()
        if application.owner_id != request.user.id:
            raise PermissionDenied("You can only edit your own applications.")
        if not application.is_editable:
            raise EditNotAllowed()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(application, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        before = {f: _display_value(f, getattr(application, f)) for f in TRACKED_FIELDS}
        with transaction.atomic():
            serializer.save()
            application.refresh_from_db()
            after = {f: _display_value(f, getattr(application, f)) for f in TRACKED_FIELDS}
            changes = {
                f: [before[f], after[f]] for f in TRACKED_FIELDS if before[f] != after[f]
            }
            if changes:
                AuditLog.objects.create(
                    application=application,
                    actor=request.user,
                    old_status=application.status,
                    new_status=application.status,
                    changes=changes,
                )
        return Response(serializer.data)

    # --- Transitions -------------------------------------------------------
    def _get_locked_object(self):
        """Return the visible application row locked for this transaction."""
        queryset = self.filter_queryset(self.get_queryset().select_for_update())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]
        application = get_object_or_404(queryset, **{self.lookup_field: lookup_value})
        self.check_object_permissions(self.request, application)
        return application

    def _perform_transition(self, request, action_name):
        comment = (request.data.get("comment") or "").strip()

        # Lock the application row before validating so concurrent reviewers
        # cannot both act on the same stale status.
        with transaction.atomic():
            application = self._get_locked_object()
            old_status = application.status
            new_status = workflow.apply_transition(
                current_status=old_status,
                action=action_name,
                actor_role=request.user.role,
                is_owner=application.owner_id == request.user.id,
                comment=comment,
            )
            application.status = new_status
            application.save(update_fields=["status", "updated_at"])
            AuditLog.objects.create(
                application=application,
                actor=request.user,
                old_status=old_status,
                new_status=new_status,
                comment=comment,
            )
            application._prefetched_objects_cache = {}

        return Response(ApplicationDetailSerializer(application).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._perform_transition(request, workflow.Action.SUBMIT)

    @action(detail=True, methods=["post"], url_path="start-review")
    def start_review(self, request, pk=None):
        return self._perform_transition(request, workflow.Action.START_REVIEW)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._perform_transition(request, workflow.Action.APPROVE)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._perform_transition(request, workflow.Action.REJECT)

    @action(detail=True, methods=["post"], url_path="return")
    def return_for_changes(self, request, pk=None):
        return self._perform_transition(request, workflow.Action.RETURN)

    @action(detail=True, methods=["get"], url_path="audit-logs")
    def audit_logs(self, request, pk=None):
        application = self.get_object()
        logs = application.audit_logs.select_related("actor").all()
        return Response(AuditLogSerializer(logs, many=True).data)
