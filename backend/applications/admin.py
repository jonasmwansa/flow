from django.contrib import admin

from .models import Application, AuditLog


class AuditLogInline(admin.TabularInline):
    model = AuditLog
    extra = 0
    can_delete = False
    readonly_fields = ("actor", "old_status", "new_status", "comment", "changes", "created_at")


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "category", "status", "attachment", "created_at")
    list_filter = ("status", "category")
    search_fields = ("title", "owner__email")
    inlines = [AuditLogInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "actor", "old_status", "new_status", "created_at")
    list_filter = ("new_status",)
    readonly_fields = ("changes",)
