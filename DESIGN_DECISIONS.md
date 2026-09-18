# Design Decisions — Session Feedback Feature

## Data model

`SessionFeedback` stores one review per student per session:

- `session`, `student`, `submitter` (foreign keys)
- Three ratings (1–5): `rating_clarity`, `rating_engagement`, `rating_pace`
- Optional `note` (max 500 characters)
- Timestamps

A unique constraint on `(session, student)` enforces "one feedback per student
per session" at the database level. So if a parent tries to submit twice for
the same child on the same session, the database itself rejects it — not just
our code.

## Server-side rules

All rules are enforced in the backend, not just hidden in the UI:

- Session must have status `completed`
- Session must be within the last 30 days
- Only the student themselves, or a parent linked to that student, can submit
- `submitter` is always set from the logged-in user — never accepted from the
  request body (so nobody can submit as someone else)
- Ratings must be 1–5 (validated on the model and in the serializer)

## Anonymization

The instructor summary endpoint returns **only numbers** — weighted averages
and a count. The response serializer simply has no fields for student name,
submitter, or notes, so it is impossible to leak identities through it. There
are also no per-session or per-student breakdowns, so even a class with one
student reveals nothing.

## Weighted rolling average

1. Take the instructor's last 10 completed sessions
2. For each session, compute the average of each rating dimension
3. Weight each session's average by its `duration_minutes`
4. Divide the weighted sum by the total weight → per-dimension score
5. Overall = average of the three dimensions

Longer sessions count more. Sessions with no feedback are skipped.

## Trade-offs (what I'd improve with more time)

- **Frontend:** the feedback form and history cards could be split into
  smaller reusable components (e.g. a shared `StarRating` component, a
  reusable list item). A state store (like Redux/Zustand) could manage
  feedback state, but for this size plain React state is simpler and enough.
- **Backend:** the aggregation is done in Python for readability; at larger
  scale it could move into a single SQL aggregate query.
- **Setup:** currently demo data needs a `seed_data` command. In a real
  project, migrations alone should set up the schema, and seed data would be
  a separate, optional step (or fixtures) — not something you need for the
  app to run.
- **No edit/delete of feedback** — kept out of scope for the one-day limit.