import type { CourseApproval } from "@/lib/course-approval";

const labels = { eligible: "Approval checked automatically", pending: "More course details needed", not_approved: "Not counted toward the pattern", review: "Source review needed" };
export default function CourseApprovalStatus({ approval }: { approval: CourseApproval }) {
  return <div className={`course-approval course-approval-${approval.status}`} role="status">
    <strong>{labels[approval.status]}</strong>
    <ul>{approval.messages.map(message => <li key={message}>{message}</li>)}</ul>
  </div>;
}
