"use client";

import type { Requirement } from "@/lib/planner";
import { getRequirementStatus, getPreparationStatus, isOptionSatisfied } from "@/lib/planner";
import Icon from "./Icon";
import APPreparationCredit from "./APPreparationCredit";

type RequirementDisplayProps = { requirement: Requirement; completedCourses: string[]; enrolledCourses?: string[]; showDepartment?: boolean };

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

export default function RequirementDisplay({ requirement, completedCourses, enrolledCourses = [], showDepartment = false }: RequirementDisplayProps) {
  const preparationStatus = getPreparationStatus(requirement, completedCourses);
  const equivalenceStatus = getRequirementStatus(requirement, completedCourses);
  const complete = preparationStatus === "satisfied";
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
        <span className={`status-badge status-${complete ? "satisfied" : "not_satisfied"}`}>{complete ? "Satisfied" : "Not satisfied"}</span>
      </div>
      {showDepartment && requirement.department && <p className="requirement-meta">Department: {requirement.department}</p>}
      <APPreparationCredit requirement={requirement} />
      {requirement.preparationOptions && <p className="requirement-meta">Course equivalence options</p>}
      {complete && requirement.preparationOptions && equivalenceStatus !== "satisfied" && !requirement.apPreparation?.satisfied && <p className="requirement-meta">Satisfied through a major-preparation exception.</p>}
      <div className="requirement-options">{requirement.options.map((option, index) => (
        <div className={`requirement-option ${isOptionSatisfied(option, completedCourses) ? "option-complete" : ""}`} key={index}>
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} enrolledCourses={enrolledCourses} />
          {isOptionSatisfied(option, completedCourses) && <span className="option-completed-label">Completed</span>}
        </div>
      ))}</div>
      {requirement.preparationOptions && <details className="preparation-block">
        <summary>Major-preparation exception</summary>
        {requirement.preparationOptions.map((option, index) => <div key={index} className="preparation-option">
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} enrolledCourses={enrolledCourses} />
          {isOptionSatisfied(option, completedCourses) && <Icon name="check" size={13} />}
        </div>)}
        {requirement.preparationNote && <details className="course-credit-notes"><summary>Substitution rule</summary><p className="requirement-note">{requirement.preparationNote}</p></details>}
      </details>}
      {requirement.articulationStatus === "no_course_articulated" && !complete && <p className="requirement-note">No Mt. SAC equivalent listed.</p>}
      {requirement.articulationStatus === "university_only" && !complete && <p className="requirement-note">This course must be taken after transfer.</p>}
      {requirement.articulationStatus === "review_required" && <p className="requirement-note">Course equivalence is unverified. Confirm the option with a counselor.</p>}
      {requirement.articulationStatus === "partial" && <p className="requirement-note">{requirement.note?.includes("additional university course after transfer") ? "An additional university course is needed after transfer." : "Only part of this requirement has a course match. Confirm the rest with the department."}</p>}
      {requirement.note && !/^(No Course Articulated|This course must be taken at the university after transfer|Must complete an additional university course after transfer to satisfy this requirement)$/i.test(requirement.note) && <details className="course-credit-notes"><summary>Course conditions</summary><p className="requirement-note">{requirement.note}</p></details>}
    </div>
  );
}
