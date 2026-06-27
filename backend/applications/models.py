from django.conf import settings
from django.db import models

from . import workflow

# Status values live in the framework-free workflow module so the state machine
# and the ORM share one source of truth; here we attach human labels for the API
# and admin.
STATUS_LABELS = {
    workflow.Status.DRAFT: "Draft",
    workflow.Status.SUBMITTED: "Submitted",
    workflow.Status.UNDER_REVIEW: "Under review",
    workflow.Status.APPROVED: "Approved",
    workflow.Status.REJECTED: "Rejected",
}
STATUS_CHOICES = [(value, STATUS_LABELS[value]) for value in workflow.Status.ALL]


class Category(models.TextChoices):
    BUSINESS = "BUSINESS", "Business"
    PERSONAL = "PERSONAL", "Personal"
    FINANCE = "FINANCE", "Finance"
    OTHER = "OTHER", "Other"


def application_attachment_path(instance, filename):
    return f"applications/{instance.owner_id}/{filename}"


class Application(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField(blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    attachment = models.FileField(
        upload_to=application_attachment_path,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=workflow.Status.DRAFT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"#{self.pk} {self.title} [{self.status}]"

    @property
    def is_editable(self) -> bool:
        return self.status in workflow.Status.EDITABLE


class AuditLog(models.Model):
    """An immutable record of one activity: a status transition or a draft edit.

    For a transition, ``old_status`` and ``new_status`` differ and ``changes`` is
    empty. For a draft edit, both statuses are the same and ``changes`` holds the
    per-field diff, ``{field: [old, new]}``.
    """

    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="audit_logs"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_actions",
    )
    old_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    new_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    comment = models.TextField(blank=True, default="")
    # Per-field diff for edit events: {field: [old, new]}. Empty for transitions.
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.application_id}: {self.old_status} -> {self.new_status}"
