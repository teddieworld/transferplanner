"use client";

import type { Requirement } from "@/lib/planner";
import { getRequirementStatus, getPreparationStatus, isOptionSatisfied, requirementStatusLabels } from "@/lib/planner";
import Icon from "./Icon";
import APPreparationCredit from "./APPreparationCredit";

type RequirementDisplayProps = { requirement: Requirement; completedCourses: string[]; enrolledCourses?: string[]; compact?: boolean; showDepartment?: boolean };

function CourseOption({ courses, titles, completedCourses, enrolledCourses }: {
  courses: string[];
  titles?: Record<string, string>;
  completedCourses: string[];
  enrolledCourses: string[];
}) {
  return <span className="option-courses">{courses.map((code, index) => (
    <span className="option-course-wrap" key={code}>
      {index > 0 && <span className="option-and">AND</span>}
      <span className={`course-code ${completedCourses.includes(code) ? "code-complete" : ""}`}>
        {completedCourses.includes(code) && <Icon name="check" size={11} />}{code}
      </span>
      {titles?.[code] && <span className="option-course-title">{titles[code]}</span>}
      {enrolledCourses.includes(code) && <span className="course-progress-label">In progress</span>}
    </span>
  ))}</span>;
}

export default function RequirementDisplay({ requirement, completedCourses, enrolledCourses = [], compact = false, showDepartment = false }: RequirementDisplayProps) {
  const preparationStatus = getPreparationStatus(requirement, completedCourses);
  const status = compact ? preparationStatus : getRequirementStatus(requirement, completedCourses);
  const complete = preparationStatus === "satisfied";
  const options = compact ? requirement.preparationOptions ?? requirement.options : requirement.options;
  return (
    <div className={`requirement-row ${complete ? "requirement-complete" : ""}`}>
      <div className="requirement-title">
        <span className={`requirement-check ${complete ? "is-complete" : ""}`}>{complete ? <Icon name="check" size={13} /> : <span />}</span>
        <strong>{requirement.receivingCourses ? requirement.receivingCourses.map((course, index) => (
          <span className="receiving-course" key={course.code}>
            {index > 0 && <span className="receiving-conjunction">AND </span>}
            {course.code}{course.title && <span className="receiving-course-title"> — {course.title}</span>}
          </span>
        )) : requirement.name}</strong>
        <span className={`status-badge status-${complete && requirement.apPreparation?.satisfied ? "satisfied" : status}`}>{requirement.apPreparation?.satisfied && complete ? "AP preparation match" : requirementStatusLabels[status]}</span>
      </div>
      {showDepartment && requirement.department && <p className="requirement-meta">Department: {requirement.department}</p>}
      <APPreparationCredit requirement={requirement} />
      {!compact && requirement.preparationOptions && <p className="requirement-meta">Course equivalence options</p>}
      <div className="requirement-options">{options.map((option, index) => (
        <div className={`requirement-option ${isOptionSatisfied(option, completedCourses) ? "option-complete" : ""}`} key={index}>
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} enrolledCourses={enrolledCourses} />
          {isOptionSatisfied(option, completedCourses) && <span className="option-completed-label">Completed</span>}
        </div>
      ))}</div>
      {!compact && requirement.preparationOptions && <div className="preparation-block">
        <p>Major preparation <span className={`status-badge status-${preparationStatus}`}>{requirementStatusLabels[preparationStatus]}</span></p>
        {requirement.preparationOptions.map((option, index) => <div key={index} className="preparation-option">
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} enrolledCourses={enrolledCourses} />
          {isOptionSatisfied(option, completedCourses) && <Icon name="check" size={13} />}
        </div>)}
        {requirement.preparationNote && <details className="course-credit-notes"><summary>Substitution rule</summary><p className="requirement-note">{requirement.preparationNote}</p></details>}
      </div>}
      {compact && requirement.preparationNote && <details className="course-credit-notes"><summary>Substitution rule</summary><p className="requirement-note">{requirement.preparationNote}</p></details>}
      {requirement.articulationStatus === "review_required" && <p className="requirement-note">Course equivalence is unverified. Confirm the option with a counselor.</p>}
      {requirement.articulationStatus === "partial" && <p className="requirement-note">{requirement.note?.includes("additional university course after transfer") ? "An additional university course is needed after transfer." : "Only part of this requirement has a course match. Confirm the rest with the department."}</p>}
      {requirement.note && !/^(No Course Articulated|This course must be taken at the university after transfer|Must complete an additional university course after transfer to satisfy this requirement)$/i.test(requirement.note) && <details className="course-credit-notes"><summary>Course conditions</summary><p className="requirement-note">{requirement.note}</p></details>}
    </div>
  );
}
