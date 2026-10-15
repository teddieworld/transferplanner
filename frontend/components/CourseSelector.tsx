"use client";

import { useState } from "react";
import { useRemoteData } from "@/lib/use-remote-data";
import type { CourseCatalogEntry } from "@/lib/catalog-types";
import Icon from "./Icon";

type CourseSelectorProps = {
  completedCourses: string[];
  onCourseChange: (courseCode: string, isChecked: boolean) => void;
  onClearCourses: () => void;
  showHeading?: boolean;
};

export default function CourseSelector({ completedCourses, onCourseChange, onClearCourses, showHeading = true }: CourseSelectorProps) {
  const { data, isLoading, error } = useRemoteData<CourseCatalogEntry[]>("/api/courses");
  const courses = data ?? [];
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const query = search.trim().toLowerCase();
  const matchingCourses = courses.filter(course =>
    `${course.code} ${course.title}`.toLowerCase().includes(query) &&
    (!selectedOnly || completedCourses.includes(course.code))
  );
  const visibleCourses = matchingCourses.slice(0, visibleCount);

  return (
    <>
      {showHeading && <div className="section-heading"><div className="heading-with-icon"><span className="step-number">02</span><div><h2 id="courses-heading">Your coursework</h2><p>Add the courses you&apos;ve already completed.</p></div></div></div>}
      <div className="course-toolbar">
        <label htmlFor="course-search" className="sr-only">Search by course code or title</label>
        <div className="search-field"><Icon name="search" size={18} /><input id="course-search" type="search" placeholder="Search code or course title..." value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(30); }} disabled={isLoading || error !== null} /></div>
        <div className="course-filter-row"><div className="segmented-control" aria-label="Filter courses"><button type="button" aria-pressed={!selectedOnly} onClick={() => { setSelectedOnly(false); setVisibleCount(30); }}>All courses</button><button type="button" aria-pressed={selectedOnly} onClick={() => { setSelectedOnly(true); setVisibleCount(30); }}>Selected <span>{completedCourses.length}</span></button></div><span className="catalog-label">Mt. SAC catalog</span></div>
      </div>
      {completedCourses.length > 0 && <div className="selected-courses" aria-label="Selected courses">{completedCourses.map(code => <button type="button" key={code} onClick={() => onCourseChange(code, false)} aria-label={`Remove ${code}`} className="course-chip">{code}<Icon name="x" size={12} /></button>)}</div>}
      {isLoading && <p className="inline-message" role="status">Loading your course catalog...</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!isLoading && !error && <div className="course-list-heading"><span>COURSE</span><span>UNITS</span></div>}
      <div className="course-list" tabIndex={0} role="region" aria-label="Mt. SAC courses">
        {visibleCourses.map(course => {
          const selected = completedCourses.includes(course.code);
          return (
            <div key={course.id} className={`course-row ${selected ? "course-row-selected" : ""}`}>
              <label className="course-selection"><input type="checkbox" checked={selected} onChange={event => onCourseChange(course.code, event.target.checked)} /><span className="course-description"><strong>{course.code}</strong><span>{course.title}</span></span><span className="course-units">{course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`}</span></label>
              <details className="course-details"><summary>Course details <Icon name="chevron" size={12} /></summary><div className="course-details-content"><div className="transfer-tags">{course.ucTransferable && <span>UC transferable</span>}{course.csuTransferable && <span>CSU transferable</span>}{!course.ucTransferable && !course.csuTransferable && <span>Not UC or CSU transferable</span>}</div>{course.description && <p>{course.description}</p>}{course.requirements.map((requirement, index) => <div key={index}><p><strong>{requirement.type}:</strong> {requirement.text}</p>{requirement.referencedCourses.length > 0 && <p>Referenced courses: {requirement.referencedCourses.join(", ")}</p>}</div>)}</div></details>
            </div>
          );
        })}
        {!isLoading && !error && matchingCourses.length === 0 && <div className="course-empty"><Icon name={selectedOnly ? "book" : "search"} size={26} /><strong>{selectedOnly && !query ? "Your courses will go here" : "No matching courses"}</strong><p>{selectedOnly && !query ? "Switch to All courses and check the classes you’ve completed." : "Try a different course code or title."}</p></div>}
        {visibleCount < matchingCourses.length && <button type="button" className="show-more" onClick={() => setVisibleCount(count => count + 30)}>Show more courses <Icon name="plus" size={15} /></button>}
      </div>
      <div className="course-panel-footer"><span aria-live="polite">{completedCourses.length} {completedCourses.length === 1 ? "course" : "courses"} selected</span><button type="button" className="text-button" onClick={onClearCourses} disabled={completedCourses.length === 0}>Clear all</button></div>
      {!isLoading && !error && <p className="catalog-count">Showing {visibleCourses.length} of {matchingCourses.length.toLocaleString()} {selectedOnly ? "selected" : "matching"} courses</p>}
    </>
  );
}
