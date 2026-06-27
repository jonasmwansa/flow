from pathlib import Path

from rest_framework import serializers

from .models import Application, AuditLog

MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_ATTACHMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_email",
            "old_status",
            "new_status",
            "comment",
            "changes",
            "created_at",
        )
        read_only_fields = fields


class ApplicationSerializer(serializers.ModelSerializer):
    """Used for list/create/update. Status and owner are never client-writable;
    status only changes through the dedicated transition endpoints."""

    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    attachment_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "owner",
            "owner_email",
            "title",
            "category",
            "description",
            "amount",
            "attachment",
            "attachment_name",
            "attachment_url",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner",
            "attachment_name",
            "attachment_url",
            "status",
            "created_at",
            "updated_at",
        )

    def get_attachment_name(self, obj):
        if not obj.attachment:
            return None
        return Path(obj.attachment.name).name

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def validate_attachment(self, attachment):
        extension = Path(attachment.name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise serializers.ValidationError(
                "Attachment must be a PDF, JPG, PNG, or WEBP file."
            )

        content_type = getattr(attachment, "content_type", "")
        if content_type and content_type not in ALLOWED_ATTACHMENT_TYPES:
            raise serializers.ValidationError(
                "Attachment must be a PDF, JPG, PNG, or WEBP file."
            )

        if attachment.size > MAX_ATTACHMENT_SIZE:
            raise serializers.ValidationError("Attachment must be 5 MB or smaller.")

        return attachment


class ApplicationDetailSerializer(ApplicationSerializer):
    """Adds the audit trail for the detail view."""

    audit_logs = AuditLogSerializer(many=True, read_only=True)

    class Meta(ApplicationSerializer.Meta):
        fields = ApplicationSerializer.Meta.fields + ("audit_logs",)
