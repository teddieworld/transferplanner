"use client";

import type { Requirement } from "@/lib/planner";
import { getRequirementStatus, getPreparationStatus, isOptionSatisfied, requirementStatusLabels } from "@/lib/planner";
import Icon from "./Icon";

type RequirementDisplayProps = { requirement: Requirement; completedCourses: string[] };

function CourseOption({ courses, titles, completedCourses }: {
  courses: string[];
  titles?: Record<string, string>;
  completedCourses: string[];
}) {
  return <span className="option-courses">{courses.map((code, index) => (
    <span className="option-course-wrap" key={code}>
      {index > 0 && <span className="option-and">AND</span>}
      <span className={`course-code ${completedCourses.includes(code) ? "code-complete" : ""}`}>
        {completedCourses.includes(code) && <Icon name="check" size={11} />}{code}
      </span>
      {titles?.[code] && <span className="option-course-title">{titles[code]}</span>}
    </span>
  ))}</span>;
}

export default function RequirementDisplay({ requirement, completedCourses }: RequirementDisplayProps) {
  const status = getRequirementStatus(requirement, completedCourses);
  const preparationStatus = getPreparationStatus(requirement, completedCourses);
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
        <span className={`status-badge status-${status}`}>{requirementStatusLabels[status]}</span>
      </div>
      {requirement.department && <p className="requirement-meta">Berkeley department: {requirement.department}</p>}
      {requirement.preparationOptions && <p className="requirement-meta">Course equivalence options</p>}
      <div className="requirement-options">{requirement.options.map((option, index) => (
        <div className={`requirement-option ${isOptionSatisfied(option, completedCourses) ? "option-complete" : ""}`} key={index}>
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} />
          {isOptionSatisfied(option, completedCourses) && <span className="option-completed-label">Completed</span>}
        </div>
      ))}</div>
      {requirement.preparationOptions && <div className="preparation-block">
        <p>Major preparation <span className={`status-badge status-${preparationStatus}`}>{requirementStatusLabels[preparationStatus]}</span></p>
        {requirement.preparationOptions.map((option, index) => <div key={index} className="preparation-option">
          {index > 0 && <span className="option-or">OR</span>}
          <CourseOption courses={option} titles={requirement.optionCourseTitles} completedCourses={completedCourses} />
          {isOptionSatisfied(option, completedCourses) && <Icon name="check" size={13} />}
        </div>)}
        {requirement.preparationNote && <p className="requirement-note">{requirement.preparationNote}</p>}
      </div>}
      {requirement.note && <p className="requirement-note">{requirement.note}</p>}
    </div>
  );
}
