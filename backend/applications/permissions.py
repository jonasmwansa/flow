from rest_framework.permissions import BasePermission


class IsApplicant(BasePermission):
    message = "Only applicants can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_applicant)


class IsReviewer(BasePermission):
    message = "Only reviewers can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_reviewer)
