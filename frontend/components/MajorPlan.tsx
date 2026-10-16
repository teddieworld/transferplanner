"use client";

import { useId } from "react";
import { isCategorySatisfied, isGroupSatisfied } from "@/lib/planner";
import type { MajorAgreement, RequirementGroup } from "@/lib/planner";
import RequirementDisplay from "./RequirementDisplay";
import Icon from "./Icon";
import { groupReviewMessage } from "@/lib/planner-copy";

type MajorPlanProps = { completedCourses: string[]; enrolledCourses?: string[]; agreement: MajorAgreement };

function Groups({ groups, completedCourses, enrolledCourses, expandFirst = true }: { groups: RequirementGroup[]; completedCourses: string[]; enrolledCourses: string[]; expandFirst?: boolean }) {
  return groups.map((group, index) => {
    const complete = isGroupSatisfied(group, completedCourses);
    return (
      <details className="requirement-group" key={group.name} open={expandFirst && index === 0}>
        <summary><span className={`group-symbol ${complete ? "group-symbol-complete" : group.reviewRequired ? "group-symbol-review" : ""}`}><Icon name={complete ? "check" : group.reviewRequired ? "info" : "list"} size={16} /></span><span className="group-summary-text"><strong>Group {group.name}</strong><span>{group.reviewRequired ? "Completion rule unverified" : group.requiredCount === null ? `Complete all ${group.requirements.length} requirements` : `Choose ${group.requiredCount} of ${group.requirements.length} requirements`}</span></span><span className={`status-badge ${group.reviewRequired ? "status-review_required" : complete ? "status-satisfied" : "status-not_satisfied"}`}>{group.reviewRequired ? "Needs review" : complete ? "Complete" : "To do"}</span><Icon name="chevron" size={16} className="details-chevron" /></summary>
        <div className="group-content">
          {group.reviewRequired && <p className="group-guidance">{groupReviewMessage(group)}</p>}
          {group.maxPerDepartment !== undefined && <p className="group-guidance">Count no more than {group.maxPerDepartment} courses from any one Berkeley department.</p>}
          {group.note && <details className="group-notes"><summary><Icon name="info" size={14} /> Group notes {group.reviewRequired && "· confirmation needed"}<Icon name="chevron" size={13} /></summary><p>{group.note}</p></details>}
          {group.requirements.map(requirement => <RequirementDisplay key={requirement.name} requirement={requirement} completedCourses={completedCourses} enrolledCourses={enrolledCourses} showDepartment={group.maxPerDepartment !== undefined} />)}
        </div>
      </details>
    );
  });
}

export default function MajorPlan({ completedCourses, enrolledCourses = [], agreement }: MajorPlanProps) {
  const admissionHeading = useId();
  const informational = agreement.kind === "informational";
  const degreeGroups = agreement.majorRequiredGroups ?? [];
  const admissionReview = agreement.requiredGroups.some(group => group.reviewRequired);
  const admissionComplete = isCategorySatisfied(agreement.requiredGroups, completedCourses);
  const reviewCount = [...agreement.requiredGroups, ...degreeGroups, ...agreement.highlyRecommendedGroups].filter(group => group.reviewRequired).length;
  return (
    <div className="major-plan">
      <div className="plan-identity"><span className="plan-campus-icon"><Icon name="building" size={21} /></span><div><span className="plan-university">{agreement.university}</span><h3>{agreement.major}</h3></div><span className="year-pill">{agreement.academicYear}</span></div>
      {reviewCount > 0 && <div className="review-callout"><Icon name="info" size={18} /><p>{reviewCount} {reviewCount === 1 ? "group needs" : "groups need"} confirmation. See the flagged groups below.</p></div>}
      {informational ? <div className="informational-plan"><h3>Program guidance</h3><p>No course checklist. Confirm preparation with the department.</p></div> : <>
        <section className="plan-category" aria-labelledby={admissionHeading}><div className="category-heading"><h4 id={admissionHeading}>Required for admission</h4><span className="category-count">{agreement.requiredGroups.length} {agreement.requiredGroups.length === 1 ? "group" : "groups"}</span></div>{agreement.requiredGroups.length > 0 ? <><Groups groups={agreement.requiredGroups} completedCourses={completedCourses} enrolledCourses={enrolledCourses} /><div className={`category-summary ${admissionComplete && !admissionReview ? "category-summary-complete" : ""}`}><Icon name={admissionComplete && !admissionReview ? "check" : admissionReview ? "info" : "compass"} size={16} /><span>Course preparation</span><strong>{admissionReview ? "Confirm options" : admissionComplete ? "Complete" : "In progress"}</strong></div></> : <p className="category-empty">No separate admission checklist. See the agreement notes.</p>}</section>
        {degreeGroups.length > 0 && <section className="plan-category"><div className="category-heading"><h4>Lower-division major requirements</h4><span className="category-count">{degreeGroups.length} {degreeGroups.length === 1 ? "group" : "groups"}</span></div><p className="category-description">{degreeGroups.some(group => group.reviewRequired) ? "Confirm timing and course combinations with a counselor." : "Some courses may be completed after transfer."}</p><Groups groups={degreeGroups} completedCourses={completedCourses} enrolledCourses={enrolledCourses} /></section>}
        {agreement.highlyRecommendedGroups.length > 0 && <section className="plan-category"><div className="category-heading"><h4>Highly recommended</h4><span className="category-count">{agreement.highlyRecommendedGroups.length} {agreement.highlyRecommendedGroups.length === 1 ? "group" : "groups"}</span></div><Groups groups={agreement.highlyRecommendedGroups} completedCourses={completedCourses} enrolledCourses={enrolledCourses} expandFirst={false} /></section>}
      </>}
      {((agreement.notes?.length ?? 0) > 0 || (agreement.reviewNotes?.length ?? 0) > 0) && <details className="agreement-notes" open={informational}><summary><span><Icon name="book" size={17} /> Agreement notes & review items</span><Icon name="chevron" size={16} /></summary><div>{agreement.reviewNotes?.map((note, index) => <p key={`review-${index}`} className="review-note">{note}</p>)}{agreement.notes?.map((note, index) => <p key={`source-${index}`}>{note}</p>)}</div></details>}
    </div>
  );
}
