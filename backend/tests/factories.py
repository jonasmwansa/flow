import factory

from accounts.models import Role, User
from applications.models import Application
from applications.workflow import Status


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    role = Role.APPLICANT

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        obj.set_password(extracted or "password123")
        if create:
            obj.save()


class ApplicantFactory(UserFactory):
    role = Role.APPLICANT


class ReviewerFactory(UserFactory):
    role = Role.REVIEWER


class ApplicationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Application

    owner = factory.SubFactory(ApplicantFactory)
    title = factory.Sequence(lambda n: f"Application {n}")
    category = "BUSINESS"
    description = "A test application."
    amount = "100.00"
    status = Status.DRAFT
