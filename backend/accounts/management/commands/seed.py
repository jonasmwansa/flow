"""Seed the database with the two demo users (and a couple of sample applications).

Idempotent: running it more than once will not create duplicates.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Role, User
from applications.models import Application
from applications.workflow import Status

SEED_USERS = [
    {"email": "applicant@example.com", "password": "password123", "role": Role.APPLICANT},
    {"email": "reviewer@example.com", "password": "password123", "role": Role.REVIEWER},
    # Django-admin superuser so /admin/ is reachable on a fresh deploy. Demo only
    # — change or remove this account for a real (non-demo) deployment.
    {
        "email": "admin@example.com",
        "password": "password123",
        "role": Role.REVIEWER,
        "is_staff": True,
        "is_superuser": True,
    },
]


class Command(BaseCommand):
    help = "Create demo applicant/reviewer/admin users and sample applications."

    @transaction.atomic
    def handle(self, *args, **options):
        users = {}
        for spec in SEED_USERS:
            user, created = User.objects.get_or_create(
                email=spec["email"], defaults={"role": spec["role"]}
            )
            # Always (re)set the documented demo password, role, and staff flags
            # so the seed is reliable even if the row already existed.
            user.role = spec["role"]
            user.is_staff = spec.get("is_staff", False)
            user.is_superuser = spec.get("is_superuser", False)
            user.set_password(spec["password"])
            user.save()
            users[spec["role"]] = user
            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Created' if created else 'Updated'} {user.email} ({user.role})"
                )
            )

        applicant = users[Role.APPLICANT]

        # A draft the applicant can keep editing.
        Application.objects.get_or_create(
            owner=applicant,
            title="Office supplies budget",
            defaults={
                "category": "FINANCE",
                "description": "Quarterly stationery and equipment budget.",
                "amount": "1200.00",
                "status": Status.DRAFT,
            },
        )
        # A submitted one so the reviewer queue is not empty.
        Application.objects.get_or_create(
            owner=applicant,
            title="Conference travel request",
            defaults={
                "category": "BUSINESS",
                "description": "Flights and accommodation for the annual summit.",
                "amount": "3500.00",
                "status": Status.SUBMITTED,
            },
        )
        self.stdout.write(self.style.SUCCESS("Seed complete."))
