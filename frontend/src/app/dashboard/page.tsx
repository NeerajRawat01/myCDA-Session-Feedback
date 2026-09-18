"use client";

import { useAuth } from "@/contexts/AuthContext";
import ActiveClassesCard from "@/components/ActiveClassesCard";
import ProfileCard from "@/components/ProfileCard";
import FeedbackFormCard from "@/components/FeedbackFormCard";
import FeedbackHistoryCard from "@/components/FeedbackHistoryCard";
import InstructorSummaryCard from "@/components/InstructorSummaryCard";

/**
 * myCDA Dashboard
 *
 * Cards are rendered based on the user's role.
 * Add your feedback-related cards below, following the same pattern.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">
        Welcome back, {user.display_name}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visible to everyone */}
        <ActiveClassesCard />
        <ProfileCard />

        {/* Students & parents */}
        {(user.role === "student" || user.role === "parent") && (
          <>
            <FeedbackFormCard />
            <FeedbackHistoryCard />
          </>
        )}

        {/* Instructors (and admins) */}
        {(user.role === "instructor" || user.role === "admin") && (
          <InstructorSummaryCard />
        )}
      </div>
    </div>
  );
}
