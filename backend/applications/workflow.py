"""The application status state machine.

This module is deliberately framework-free: it imports nothing from Django and
touches no database. It is the single source of truth for which transitions are
legal, who may perform them, and which require a comment. The API layer is the
only caller; views must never re-implement these rules.

Decisions (see README):
* "return for changes" moves an application back to DRAFT (matching the spec
  diagram), so the owner can edit and resubmit. The audit log preserves the
  round-trip (an UNDER_REVIEW -> DRAFT entry vs. a fresh draft with no history).
* approve / reject / return are only valid from UNDER_REVIEW (a reviewer must
  start review first). This keeps the machine predictable.
* reject and return require a non-empty comment.
"""
from __future__ import annotations

from dataclasses import dataclass


class Status:
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

    ALL = (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED)
    # States in which the owner is allowed to edit the application's fields.
    EDITABLE = (DRAFT,)


class Action:
    SUBMIT = "submit"
    START_REVIEW = "start_review"
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"

    ALL = (SUBMIT, START_REVIEW, APPROVE, REJECT, RETURN)


class Role:
    APPLICANT = "APPLICANT"
    REVIEWER = "REVIEWER"


@dataclass(frozen=True)
class Transition:
    action: str
    from_statuses: tuple[str, ...]
    to_status: str
    role: str
    requires_comment: bool = False
    owner_only: bool = False


# The complete transition table. Adding a workflow rule means editing this dict
# and nothing else.
TRANSITIONS: dict[str, Transition] = {
    Action.SUBMIT: Transition(
        action=Action.SUBMIT,
        from_statuses=(Status.DRAFT,),
        to_status=Status.SUBMITTED,
        role=Role.APPLICANT,
        owner_only=True,
    ),
    Action.START_REVIEW: Transition(
        action=Action.START_REVIEW,
        from_statuses=(Status.SUBMITTED,),
        to_status=Status.UNDER_REVIEW,
        role=Role.REVIEWER,
    ),
    Action.APPROVE: Transition(
        action=Action.APPROVE,
        from_statuses=(Status.UNDER_REVIEW,),
        to_status=Status.APPROVED,
        role=Role.REVIEWER,
    ),
    Action.REJECT: Transition(
        action=Action.REJECT,
        from_statuses=(Status.UNDER_REVIEW,),
        to_status=Status.REJECTED,
        role=Role.REVIEWER,
        requires_comment=True,
    ),
    Action.RETURN: Transition(
        action=Action.RETURN,
        from_statuses=(Status.UNDER_REVIEW,),
        to_status=Status.DRAFT,
        role=Role.REVIEWER,
        requires_comment=True,
    ),
}


# --- Errors ---------------------------------------------------------------
class WorkflowError(Exception):
    """Base class for all workflow rule violations."""


class UnknownAction(WorkflowError):
    """The requested action is not part of the workflow."""


class TransitionNotAllowed(WorkflowError):
    """The action is not legal from the application's current status."""


class TransitionForbidden(WorkflowError):
    """The actor's role (or ownership) does not permit this action."""


class CommentRequired(WorkflowError):
    """The action requires a non-empty comment and none was supplied."""


# --- Core API -------------------------------------------------------------
def get_transition(action: str) -> Transition:
    try:
        return TRANSITIONS[action]
    except KeyError as exc:
        raise UnknownAction(f"Unknown action '{action}'.") from exc


def apply_transition(
    *,
    current_status: str,
    action: str,
    actor_role: str,
    is_owner: bool,
    comment: str = "",
) -> str:
    """Validate a transition and return the resulting status.

    Raises a specific WorkflowError subclass on any rule violation. Performs no
    persistence — the caller is responsible for saving the new status and writing
    the audit log inside a database transaction.

    Check order matters: authorization (role/ownership) is evaluated before the
    state check so that, e.g., an applicant trying to approve their own
    application gets a "forbidden" result rather than "illegal transition".
    """
    transition = get_transition(action)

    if actor_role != transition.role:
        raise TransitionForbidden(
            f"Only a {transition.role.lower()} may '{action}' an application."
        )

    if transition.owner_only and not is_owner:
        raise TransitionForbidden("Only the owner may perform this action.")

    if current_status not in transition.from_statuses:
        raise TransitionNotAllowed(
            f"Cannot '{action}' an application in status '{current_status}'."
        )

    if transition.requires_comment and not (comment and comment.strip()):
        raise CommentRequired(f"A comment is required to '{action}' an application.")

    return transition.to_status
