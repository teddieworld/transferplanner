import type { MajorAgreement } from "@/lib/planner";

export default function MajorAPReview({ review }: { review: MajorAgreement["apPreparationReview"] }) {
  if (!review) return null;
  return <>
    {review.unmatchedExams.length > 0 && <div className="group-guidance"><p><strong>AP exams not applied to this major:</strong> {review.unmatchedExams.join("; ")}.</p><p>{review.message}</p></div>}
    {review.policyNote && <details className="group-notes"><summary>Major AP policy</summary><p>{review.policyNote}</p></details>}
  </>;
}
