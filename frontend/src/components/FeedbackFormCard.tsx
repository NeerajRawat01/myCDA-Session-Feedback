"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Session } from "@/lib/types";
import DashboardCard from "./DashboardCard";

const DIMENSIONS = [
  { key: "rating_clarity", label: "Clarity" },
  { key: "rating_engagement", label: "Engagement" },
  { key: "rating_pace", label: "Pace" },
] as const;

type RatingKey = (typeof DIMENSIONS)[number]["key"];

const MAX_NOTE_LENGTH = 500;

function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            className={`text-lg leading-none transition-colors ${
              n <= value ? "text-amber-400" : "text-gray-300 hover:text-gray-400"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Feedback submission form for students and parents.
 * Optimistic UI: the session is removed from the eligible list immediately
 * on submit and restored if the server rejects the request.
 */
export default function FeedbackFormCard() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const children = user?.family_links ?? [];

  const [studentId, setStudentId] = useState<number | "">(
    isParent ? "" : (user?.id ?? "")
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | "">("");
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    rating_clarity: 0,
    rating_engagement: 0,
    rating_pace: 0,
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback((sid: number | "") => {
    if (!sid) {
      setSessions([]);
      return;
    }
    setLoading(true);
    const query = isParent ? `?student=${sid}` : "";
    api
      .get<Session[]>(`/feedback/eligible/${query}`)
      .then(setSessions)
      .catch(() => setError("Could not load eligible sessions."))
      .finally(() => setLoading(false));
  }, [isParent]);

  useEffect(() => {
    if (!isParent) loadSessions(user?.id ?? "");
  }, [isParent, user?.id, loadSessions]);

  const handleStudentChange = (value: string) => {
    const sid = value ? Number(value) : "";
    setStudentId(sid);
    setSelectedSession("");
    setSessions([]);
    setSuccess(false);
    setError("");
    loadSessions(sid);
  };

  const extractError = (err: unknown): string => {
    if (err instanceof ApiError) {
      const body = err.body as Record<string, string | string[]>;
      for (const value of Object.values(body)) {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && value.length) return String(value[0]);
      }
    }
    return "Could not submit feedback. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!selectedSession || Object.values(ratings).some((r) => r === 0)) {
      setError("Please select a session and rate all three dimensions.");
      return;
    }

    // Optimistic update: remove the session as if submission succeeded.
    const previous = sessions;
    setSessions(sessions.filter((s) => s.id !== selectedSession));

    try {
      const body: Record<string, unknown> = {
        session: selectedSession,
        ...ratings,
        note,
      };
      if (isParent && studentId) body.student = studentId;
      await api.post("/feedback/", body);
      setSuccess(true);
      setSelectedSession("");
      setRatings({ rating_clarity: 0, rating_engagement: 0, rating_pace: 0 });
      setNote("");
    } catch (err) {
      // Roll back the optimistic update and surface the server error.
      setSessions(previous);
      setError(extractError(err));
    }
  };

  return (
    <DashboardCard
      title="Submit Feedback"
      subtitle="Rate a recently completed session"
    >
      {isParent && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Student
          </label>
          <select
            value={studentId}
            onChange={(e) => handleStudentChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cda-navy focus:outline-none"
          >
            <option value="">Select a student…</option>
            {children.map((link) => (
              <option key={link.student} value={link.student}>
                {link.student_display.display_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">
          {isParent && !studentId
            ? "Select a student to see their eligible sessions."
            : "No sessions are currently eligible for feedback."}
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) =>
                setSelectedSession(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cda-navy focus:outline-none"
            >
              <option value="">Select a session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class_name} —{" "}
                  {new Date(s.scheduled_date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 space-y-2">
            {DIMENSIONS.map((d) => (
              <StarInput
                key={d.key}
                label={d.label}
                value={ratings[d.key]}
                onChange={(v) =>
                  setRatings((prev) => ({ ...prev, [d.key]: v }))
                }
              />
            ))}
          </div>

          <div className="mb-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder="Optional note…"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cda-navy focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {note.length}/{MAX_NOTE_LENGTH}
            </p>
          </div>

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          {success && (
            <p className="mb-3 text-sm text-green-600">
              Feedback submitted. Thank you!
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-cda-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Submit Feedback
          </button>
        </form>
      )}
    </DashboardCard>
  );
}