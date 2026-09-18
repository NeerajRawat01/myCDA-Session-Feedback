from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from accounts.models import FamilyLink, User
from accounts.serializers import UserMinimalSerializer
from classes.models import Session
from classes.serializers import SessionSerializer
from core.serializers import BaseModelSerializer

from .models import SessionFeedback

FEEDBACK_WINDOW_DAYS = 30


class SessionFeedbackSerializer(BaseModelSerializer):
    """Read/write serializer for feedback submitted by students/parents."""

    student = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="student"),
        required=False,
    )
    student_display = UserMinimalSerializer(source="student", read_only=True)
    class_name = serializers.CharField(
        source="session.class_obj.name", read_only=True
    )
    session_date = serializers.DateTimeField(
        source="session.scheduled_date", read_only=True
    )

    class Meta:
        model = SessionFeedback
        fields = [
            "id",
            "session",
            "student",
            "student_display",
            "class_name",
            "session_date",
            "rating_clarity",
            "rating_engagement",
            "rating_pace",
            "note",
            "created_at",
            "updated_at",
            "created_by_display",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        # Duplicate (session, student) is enforced by the DB constraint and
        # validated with a friendly message in validate(); the auto-added
        # UniqueTogetherValidator would wrongly make `student` required.
        validators = []

    def validate_session(self, session):
        if session.status != Session.Status.COMPLETED:
            raise serializers.ValidationError(
                "Feedback can only be submitted for completed sessions."
            )
        cutoff = timezone.now() - timedelta(days=FEEDBACK_WINDOW_DAYS)
        if session.scheduled_date < cutoff:
            raise serializers.ValidationError(
                "Feedback cannot be submitted for sessions completed "
                f"more than {FEEDBACK_WINDOW_DAYS} days ago."
            )
        return session

    def validate(self, data):
        user = self.context["request"].user
        session = data.get("session")
        student = data.get("student")

        # Default the student to the submitter when they are a student.
        if student is None:
            if user.role == "student":
                student = user
            else:
                raise serializers.ValidationError(
                    {"student": "This field is required for parents."}
                )
        data["student"] = student

        # Only the student themselves or a linked parent may submit.
        if user.role == "student":
            if student.id != user.id:
                raise serializers.ValidationError(
                    {"student": "Students can only submit feedback for themselves."}
                )
        elif user.role == "parent":
            if not FamilyLink.objects.filter(parent=user, student=student).exists():
                raise serializers.ValidationError(
                    {"student": "You can only submit feedback for your linked students."}
                )
        else:
            raise serializers.ValidationError(
                "Only students and parents can submit feedback."
            )

        # Duplicate check on (session, student).
        if (
            session is not None
            and SessionFeedback.objects.filter(
                session=session, student=student
            ).exists()
        ):
            raise serializers.ValidationError(
                "Feedback already submitted for this session."
            )
        return data

    def create(self, validated_data):
        # Submitter is always the authenticated user, never from the body.
        validated_data["submitter"] = self.context["request"].user
        return super().create(validated_data)


class EligibleSessionSerializer(SessionSerializer):
    """Sessions a student may review (completed, within 30 days)."""


class InstructorSummarySerializer(serializers.Serializer):
    """Anonymized, weighted rolling-average summary for instructors."""

    clarity = serializers.FloatField()
    engagement = serializers.FloatField()
    pace = serializers.FloatField()
    overall = serializers.FloatField()
    total_feedback = serializers.IntegerField()
    sessions_count = serializers.IntegerField()