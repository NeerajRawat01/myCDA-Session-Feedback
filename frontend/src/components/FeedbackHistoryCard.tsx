"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { FeedbackItem, PaginatedResponse } from "@/lib/types";
import DashboardCard from "./DashboardCard";

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value} of 5`}>
      {"★".repeat(value)}
      <span className="text-gray-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

/**
 * Previously submitted feedback. For parents, entries are grouped
 * by linked student.
 */
export default function FeedbackHistoryCard() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PaginatedResponse<FeedbackItem>>("/feedback/my/")
      .then((res) => setItems(res.results))
      .catch(() => setError("Could not load feedback history."))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedbackItem[]>();
    for (const item of items) {
      const key = item.student_display.display_name;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [items]);

  const renderList = (entries: FeedbackItem[]) => (
    <ul className="divide-y divide-gray-100">
      {entries.map((f) => (
        <li key={f.id} className="px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{f.class_name}</p>
            <p className="text-xs text-gray-500">
              {new Date(f.session_date).toLocaleDateString()}
            </p>
          </div>
          <div className="mt-1 flex gap-4 text-xs text-gray-600">
            <span>Clarity <Stars value={f.rating_clarity} /></span>
            <span>Engagement <Stars value={f.rating_engagement} /></span>
            <span>Pace <Stars value={f.rating_pace} /></span>
          </div>
          {f.note && (
            <p className="mt-1 text-xs italic text-gray-500">“{f.note}”</p>
          )}
        </li>
      ))}
    </ul>
  );

  let body;
  if (loading) {
    body = <p className="px-5 py-4 text-sm text-gray-400">Loading...</p>;
  } else if (error) {
    body = <p className="px-5 py-4 text-sm text-red-500">{error}</p>;
  } else if (items.length === 0) {
    body = (
      <p className="px-5 py-4 text-sm text-gray-500">No feedback submitted yet.</p>
    );
  } else if (isParent) {
    body = grouped.map(([name, entries]) => (
      <section key={name}>
        <h4 className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {name}
        </h4>
        {renderList(entries)}
      </section>
    ));
  } else {
    body = renderList(items);
  }

  return (
    <DashboardCard
      title="My Feedback"
      subtitle={`${items.length} submitted`}
      flush
    >
      {body}
    </DashboardCard>
  );
}