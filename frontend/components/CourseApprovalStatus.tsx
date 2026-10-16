import type { CourseApproval } from "@/lib/course-approval";

const labels = { eligible: "Eligible for the seven-course pattern", pending: "Details missing", not_approved: "Not counted toward the pattern", review: "Confirm with a counselor", in_progress: "In progress · not counted yet" };
export default function CourseApprovalStatus({ approval }: { approval: CourseApproval }) {
  if (approval.status === "eligible" || approval.status === "in_progress") return <p className={`course-approval-label course-approval-${approval.status}`}>{labels[approval.status]}</p>;
  return <div className={`course-approval course-approval-${approval.status}`} role="status">
    <strong>{labels[approval.status]}</strong>
    <ul>{approval.messages.map(message => <li key={message}>{message}</li>)}</ul>
  </div>;
}
