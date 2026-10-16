"use client";

import { useId } from "react";
import { isCategorySatisfied, isGroupSatisfied } from "@/lib/planner";
import type { MajorAgreement, RequirementGroup } from "@/lib/planner";
import RequirementDisplay from "./RequirementDisplay";
import Icon from "./Icon";

type MajorPlanProps = { completedCourses: string[]; agreement: MajorAgreement };

function Groups({ groups, completedCourses, expandFirst = true }: { groups: RequirementGroup[]; completedCourses: string[]; expandFirst?: boolean }) {
  return groups.map((group, index) => {
    const complete = isGroupSatisfied(group, completedCourses);
    return (
      <details className="requirement-group" key={group.name} open={expandFirst && index === 0}>
        <summary><span className={`group-symbol ${complete ? "group-symbol-complete" : group.reviewRequired ? "group-symbol-review" : ""}`}><Icon name={complete ? "check" : group.reviewRequired ? "info" : "list"} size={16} /></span><span className="group-summary-text"><strong>Group {group.name}</strong><span>{group.reviewRequired ? "Completion rules need adviser review" : group.requiredCount === null ? `Complete all ${group.requirements.length} requirements` : `Choose ${group.requiredCount} of ${group.requirements.length} requirements`}</span></span><span className={`status-badge ${group.reviewRequired ? "status-review_required" : complete ? "status-satisfied" : "status-not_satisfied"}`}>{group.reviewRequired ? "Needs review" : complete ? "Complete" : "To do"}</span><Icon name="chevron" size={16} className="details-chevron" /></summary>
        <div className="group-content">
          {group.maxPerDepartment !== undefined && <p className="group-guidance">Count no more than {group.maxPerDepartment} courses from any one Berkeley department.</p>}
          {group.note && <details className="group-notes"><summary><Icon name="info" size={14} /> Group notes {group.reviewRequired && "· adviser review needed"}<Icon name="chevron" size={13} /></summary><p>{group.note}</p></details>}
          {group.requirements.map(requirement => <RequirementDisplay key={requirement.name} requirement={requirement} completedCourses={completedCourses} />)}
        </div>
      </details>
    );
  });
}

export default function MajorPlan({ completedCourses, agreement }: MajorPlanProps) {
  const admissionHeading = useId();
  const informational = agreement.kind === "informational";
  const degreeGroups = agreement.majorRequiredGroups ?? [];
  const admissionReview = agreement.requiredGroups.some(group => group.reviewRequired);
  const admissionComplete = isCategorySatisfied(agreement.requiredGroups, completedCourses);
  const reviewCount = [...agreement.requiredGroups, ...degreeGroups, ...agreement.highlyRecommendedGroups].filter(group => group.reviewRequired).length;
  return (
    <div className="major-plan">
      <div className="plan-identity"><span className="plan-campus-icon"><Icon name="building" size={21} /></span><div><span className="plan-university">{agreement.university}</span><h3>{agreement.major}</h3></div><span className="year-pill">{agreement.academicYear}</span></div>
      {agreement.apPreparationReview && <div className="group-guidance"><p>{agreement.apPreparationReview.message}</p>{agreement.apPreparationReview.unmatchedExams.length > 0 && <p>No automatic major match: {agreement.apPreparationReview.unmatchedExams.join("; ")}. These exams can still count toward UC units or the seven-course pattern under those separate rules.</p>}</div>}
      {reviewCount > 0 && <div className="review-callout"><Icon name="info" size={18} /><p><strong>Requirements needing adviser review</strong> {reviewCount} {reviewCount === 1 ? "group has" : "groups have"} rules that need adviser review. Those groups won&apos;t automatically count as complete.</p></div>}
      {informational ? <div className="informational-plan"><h3>Program guidance</h3><p>This agreement provides program guidance rather than a course checklist. Read the notes below and consult the department to plan your preparation.</p></div> : <>
        <section className="plan-category" aria-labelledby={admissionHeading}><div className="category-heading"><h4 id={admissionHeading}>Required for admission</h4><span className="category-count">{agreement.requiredGroups.length} {agreement.requiredGroups.length === 1 ? "group" : "groups"}</span></div>{agreement.requiredGroups.length > 0 ? <><Groups groups={agreement.requiredGroups} completedCourses={completedCourses} /><div className={`category-summary ${admissionComplete && !admissionReview ? "category-summary-complete" : ""}`}><Icon name={admissionComplete && !admissionReview ? "check" : admissionReview ? "info" : "compass"} size={16} /><span>Course preparation</span><strong>{admissionReview ? "Needs adviser review" : admissionComplete ? "Complete" : "In progress"}</strong></div><p className="category-footnote">Course matches cover the listed mappings. Check agreement notes for grades, deadlines, and other conditions.</p></> : <p className="category-empty">No separate admission checklist is available in this plan. Review the source notes for admission requirements.</p>}</section>
        {degreeGroups.length > 0 && <section className="plan-category"><div className="category-heading"><h4>Lower-division major requirements</h4><span className="category-count">{degreeGroups.length} {degreeGroups.length === 1 ? "group" : "groups"}</span></div><p className="category-description">{degreeGroups.some(group => group.reviewRequired) ? "Review the source notes to confirm completion rules and when these courses must be taken." : "Degree preparation beyond the admission checklist. Some courses may be completed after transfer."}</p><Groups groups={degreeGroups} completedCourses={completedCourses} /></section>}
        {agreement.highlyRecommendedGroups.length > 0 && <section className="plan-category"><div className="category-heading"><h4>Highly recommended</h4><span className="category-count">{agreement.highlyRecommendedGroups.length} {agreement.highlyRecommendedGroups.length === 1 ? "group" : "groups"}</span></div><p className="category-description">Recommended preparation listed in this agreement.</p><Groups groups={agreement.highlyRecommendedGroups} completedCourses={completedCourses} expandFirst={false} /></section>}
      </>}
      {((agreement.notes?.length ?? 0) > 0 || (agreement.reviewNotes?.length ?? 0) > 0) && <details className="agreement-notes" open={informational}><summary><span><Icon name="book" size={17} /> Agreement notes & review items</span><Icon name="chevron" size={16} /></summary><div>{agreement.reviewNotes?.map((note, index) => <p key={`review-${index}`} className="review-note">{note}</p>)}{agreement.notes?.map((note, index) => <p key={`source-${index}`}>{note}</p>)}</div></details>}
    </div>
  );
}
