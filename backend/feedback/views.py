from datetime import timedelta

from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import FamilyLink
from classes.models import Session
from core.pagination import StandardPagination
from core.permissions import IsStudentOrParent, IsInstructorOrAdmin

from .models import SessionFeedback
from .serializers import (
    EligibleSessionSerializer,
    InstructorSummarySerializer,
    SessionFeedbackSerializer,
)

FEEDBACK_WINDOW_DAYS = 30
ROLLING_SESSION_COUNT = 10


class FeedbackCreateView(generics.CreateAPIView):
    """POST feedback for a completed session (students and parents)."""

    serializer_class = SessionFeedbackSerializer
    permission_classes = [IsStudentOrParent]


class MyFeedbackListView(generics.ListAPIView):
    """List feedback submitted by the user (or for a parent's linked students)."""

    serializer_class = SessionFeedbackSerializer
    permission_classes = [IsStudentOrParent]
    pagination_class = StandardPagination

    def get_queryset(self):
        user = self.request.user
        if user.role == "parent":
            children = FamilyLink.objects.filter(
                parent=user
            ).values_list("student_id", flat=True)
            return SessionFeedback.objects.filter(
                student__in=children
            ).select_related("session", "session__class_obj", "student")
        return SessionFeedback.objects.filter(
            student=user
        ).select_related("session", "session__class_obj", "student")


class EligibleSessionsView(generics.ListAPIView):
    """
    Completed sessions (within 30 days) the user can still review.

    Parents pass ?student=<id> to get eligible sessions for a linked student.
    """

    serializer_class = EligibleSessionSerializer
    permission_classes = [IsStudentOrParent]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if user.role == "parent":
            student_id = self.request.query_params.get("student")
            if not student_id or not FamilyLink.objects.filter(
                parent=user, student_id=student_id
            ).exists():
                return Session.objects.none()
            student_id = int(student_id)
        else:
            student_id = user.id

        cutoff = timezone.now() - timedelta(days=FEEDBACK_WINDOW_DAYS)
        reviewed_ids = SessionFeedback.objects.filter(
            student_id=student_id
        ).values_list("session_id", flat=True)

        return (
            Session.objects.filter(
                status=Session.Status.COMPLETED,
                scheduled_date__gte=cutoff,
                class_obj__enrollments__student_id=student_id,
                class_obj__enrollments__is_active=True,
            )
            .exclude(id__in=reviewed_ids)
            .select_related("class_obj", "class_obj__instructor")
        )


class InstructorSummaryView(APIView):
    """
    GET anonymized, duration-weighted rolling average over the last 10
    completed sessions for the requesting instructor (or ?instructor_id=X
    for admins).
    """

    permission_classes = [IsInstructorOrAdmin]

    def get(self, request):
        instructor = request.user
        if request.user.role == "admin":
            instructor_id = request.query_params.get("instructor_id")
            if not instructor_id:
                return Response(
                    {"detail": "instructor_id is required for admins."},
                    status=400,
                )
            instructor_id = int(instructor_id)
        else:
            instructor_id = instructor.id

        sessions = (
            Session.objects.filter(
                status=Session.Status.COMPLETED,
                class_obj__instructor_id=instructor_id,
            )
            .order_by("-scheduled_date")[:ROLLING_SESSION_COUNT]
        )

        weighted = {"clarity": 0.0, "engagement": 0.0, "pace": 0.0}
        total_weight = 0.0
        total_feedback = 0

        for session in sessions:
            entries = list(session.feedback_entries.all())
            if not entries:
                continue
            weight = session.duration_minutes
            total_weight += weight
            count = len(entries)
            total_feedback += count
            for dim in weighted:
                session_avg = (
                    sum(getattr(e, f"rating_{dim}") for e in entries) / count
                )
                weighted[dim] += session_avg * weight

        if total_weight == 0:
            data = {
                "clarity": 0.0,
                "engagement": 0.0,
                "pace": 0.0,
                "overall": 0.0,
                "total_feedback": 0,
                "sessions_count": 0,
            }
        else:
            data = {
                "clarity": round(weighted["clarity"] / total_weight, 2),
                "engagement": round(weighted["engagement"] / total_weight, 2),
                "pace": round(weighted["pace"] / total_weight, 2),
                "overall": round(
                    sum(weighted.values()) / (3 * total_weight), 2
                ),
                "total_feedback": total_feedback,
                "sessions_count": len(sessions),
            }
        return Response(InstructorSummarySerializer(data).data)