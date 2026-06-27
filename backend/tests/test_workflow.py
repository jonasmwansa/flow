"""Unit tests for the pure state machine. No database required."""
import pytest

from applications import workflow
from applications.workflow import Action, Role, Status

OWNER = True
NOT_OWNER = False


# --- Legal transitions ----------------------------------------------------
@pytest.mark.parametrize(
    "current_status,action,role,is_owner,comment,expected",
    [
        (Status.DRAFT, Action.SUBMIT, Role.APPLICANT, OWNER, "", Status.SUBMITTED),
        (Status.SUBMITTED, Action.START_REVIEW, Role.REVIEWER, NOT_OWNER, "", Status.UNDER_REVIEW),
        (Status.UNDER_REVIEW, Action.APPROVE, Role.REVIEWER, NOT_OWNER, "", Status.APPROVED),
        (Status.UNDER_REVIEW, Action.REJECT, Role.REVIEWER, NOT_OWNER, "no good", Status.REJECTED),
        # "return for changes" sends the application back to DRAFT (spec diagram).
        (Status.UNDER_REVIEW, Action.RETURN, Role.REVIEWER, NOT_OWNER, "fix this", Status.DRAFT),
    ],
)
def test_legal_transitions(current_status, action, role, is_owner, comment, expected):
    result = workflow.apply_transition(
        current_status=current_status,
        action=action,
        actor_role=role,
        is_owner=is_owner,
        comment=comment,
    )
    assert result == expected


# --- Comment-required rules ------------------------------------------------
@pytest.mark.parametrize("action", [Action.REJECT, Action.RETURN])
@pytest.mark.parametrize("comment", ["", "   "])
def test_reject_and_return_require_non_empty_comment(action, comment):
    with pytest.raises(workflow.CommentRequired):
        workflow.apply_transition(
            current_status=Status.UNDER_REVIEW,
            action=action,
            actor_role=Role.REVIEWER,
            is_owner=NOT_OWNER,
            comment=comment,
        )


# --- Authorization (role / ownership) -------------------------------------
def test_applicant_cannot_approve():
    with pytest.raises(workflow.TransitionForbidden):
        workflow.apply_transition(
            current_status=Status.UNDER_REVIEW,
            action=Action.APPROVE,
            actor_role=Role.APPLICANT,
            is_owner=OWNER,
            comment="",
        )


def test_reviewer_cannot_submit():
    with pytest.raises(workflow.TransitionForbidden):
        workflow.apply_transition(
            current_status=Status.DRAFT,
            action=Action.SUBMIT,
            actor_role=Role.REVIEWER,
            is_owner=NOT_OWNER,
            comment="",
        )


def test_non_owner_applicant_cannot_submit():
    with pytest.raises(workflow.TransitionForbidden):
        workflow.apply_transition(
            current_status=Status.DRAFT,
            action=Action.SUBMIT,
            actor_role=Role.APPLICANT,
            is_owner=NOT_OWNER,
            comment="",
        )


def test_forbidden_is_raised_before_illegal_transition():
    """An applicant approving their own SUBMITTED app fails on role, not state."""
    with pytest.raises(workflow.TransitionForbidden):
        workflow.apply_transition(
            current_status=Status.SUBMITTED,
            action=Action.APPROVE,
            actor_role=Role.APPLICANT,
            is_owner=OWNER,
            comment="",
        )


# --- Illegal transitions (wrong source state) -----------------------------
@pytest.mark.parametrize(
    "current_status,action,role",
    [
        (Status.SUBMITTED, Action.APPROVE, Role.REVIEWER),   # must start review first
        (Status.SUBMITTED, Action.SUBMIT, Role.APPLICANT),   # already submitted
        (Status.APPROVED, Action.START_REVIEW, Role.REVIEWER),
        (Status.APPROVED, Action.REJECT, Role.REVIEWER),
        (Status.REJECTED, Action.APPROVE, Role.REVIEWER),
        (Status.DRAFT, Action.START_REVIEW, Role.REVIEWER),
        (Status.DRAFT, Action.APPROVE, Role.REVIEWER),
    ],
)
def test_illegal_transitions_from_wrong_state(current_status, action, role):
    # is_owner=OWNER so owner-only actions (submit) reach the state check rather
    # than failing the ownership guard first.
    with pytest.raises(workflow.TransitionNotAllowed):
        workflow.apply_transition(
            current_status=current_status,
            action=action,
            actor_role=role,
            is_owner=OWNER,
            comment="a comment in case one is required",
        )


def test_unknown_action_is_rejected():
    with pytest.raises(workflow.UnknownAction):
        workflow.apply_transition(
            current_status=Status.DRAFT,
            action="teleport",
            actor_role=Role.REVIEWER,
            is_owner=NOT_OWNER,
        )


def test_approved_and_rejected_are_terminal():
    """No action defined in the table can move out of a terminal state."""
    for terminal in (Status.APPROVED, Status.REJECTED):
        for action in Action.ALL:
            transition = workflow.TRANSITIONS[action]
            assert terminal not in transition.from_statuses
