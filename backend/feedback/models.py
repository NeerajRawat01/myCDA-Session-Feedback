from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from accounts.models import User
from classes.models import Session


class SessionFeedback(models.Model):
    """
    Structured, anonymized feedback for a completed session.

    Uniqueness is on (session, student): a parent re-submitting for the
    same student on the same session is a duplicate.
    """

    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="feedback_entries",
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedback_about_me",
        limit_choices_to={"role": "student"},
    )
    submitter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedback_submitted",
    )
    rating_clarity = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    rating_engagement = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    rating_pace = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    note = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "student"],
                name="unique_feedback_per_student_per_session",
            ),
        ]

    def __str__(self):
        return f"Feedback for {self.session} (student #{self.student_id})"