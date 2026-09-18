"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { InstructorSummary } from "@/lib/types";
import DashboardCard from "./DashboardCard";

const DIMENSIONS = [
  { key: "clarity", label: "Clarity" },
  { key: "engagement", label: "Engagement" },
  { key: "pace", label: "Pace" },
] as const;

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-900">
          {value > 0 ? `${value.toFixed(2)} / 5` : "—"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-cda-navy transition-all"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Aggregated, anonymized feedback scores for the requesting instructor
 * (admins see a specific instructor's summary via ?instructor_id).
 */
export default function InstructorSummaryCard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [summary, setSummary] = useState<InstructorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<InstructorSummary>("/feedback/instructor-summary/")
      .then(setSummary)
      .catch(() => setError("Could not load feedback summary."))
      .finally(() => setLoading(false));
  }, []);

  let body;
  if (loading) {
    body = <p className="text-sm text-gray-400">Loading...</p>;
  } else if (error) {
    body = <p className="text-sm text-red-500">{error}</p>;
  } else if (!summary || summary.total_feedback === 0) {
    body = (
      <p className="text-sm text-gray-500">
        No feedback received yet for your recent sessions.
      </p>
    );
  } else {
    body = (
      <div>
        <div className="mb-4 flex items-center gap-4 rounded-md bg-cda-mint/20 p-4">
          <span className="text-3xl font-semibold text-cda-navy">
            {summary.overall.toFixed(2)}
          </span>
          <div className="text-xs text-gray-600">
            <p className="font-medium text-gray-900">Overall weighted score</p>
            <p>
              Last {summary.sessions_count} completed session
              {summary.sessions_count !== 1 ? "s" : ""} ·{" "}
              {summary.total_feedback} feedback entr
              {summary.total_feedback !== 1 ? "ies" : "y"}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {DIMENSIONS.map((d) => (
            <ScoreBar key={d.key} label={d.label} value={summary[d.key]} />
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Scores are aggregated and anonymized — no student identities or
          written notes are included.
        </p>
      </div>
    );
  }

  return (
    <DashboardCard
      title="Session Feedback Summary"
      subtitle={isAdmin ? "View a specific instructor via API" : undefined}
    >
      {body}
    </DashboardCard>
  );
}