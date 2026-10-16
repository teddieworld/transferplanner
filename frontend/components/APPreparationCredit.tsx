import type { Requirement } from "@/lib/planner";

export default function APPreparationCredit({ requirement }: { requirement: Requirement }) {
  const credit = requirement.apPreparation;
  if (!credit) return null;
  return <div className="preparation-block ap-preparation-credit">
    <p><strong>{credit.satisfied ? "Major preparation matched by AP" : "AP credit to review"}</strong> · {requirement.name}</p>
    {credit.matches.map((match, index) => <p className="requirement-note" key={index}>
      {[...match.exams, ...match.collegeCourses ?? []].join(" AND ")} → {match.covers.join(" AND ")}. {match.note}{" "}
      <a href={match.source} target="_blank" rel="noreferrer">Major AP policy ↗</a>
    </p>)}
    {credit.reviewNote && <p className="requirement-note">{credit.reviewNote}</p>}
  </div>;
}
