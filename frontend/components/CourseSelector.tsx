"use client";

import { useState } from "react";
import { useRemoteData } from "@/lib/use-remote-data";
import type { CourseCatalogEntry } from "@/lib/catalog-types";

type CourseSelectorProps = {
    completedCourses : string[];
    onCourseChange : (courseCode:string, isChecked:boolean) => void;
    onClearCourses: () => void;
};

export default function CourseSelector({
    completedCourses,
    onCourseChange,
    onClearCourses
}:CourseSelectorProps)
{
    const { data, isLoading, error } = useRemoteData<CourseCatalogEntry[]>("/api/courses");
    const courses = data ?? [];
    const [search, setSearch] = useState("");
    const [visibleCount, setVisibleCount] = useState(100);
    const query = search.trim().toLowerCase();
    const matchingCourses = courses.filter(course =>
        `${course.code} ${course.title}`.toLowerCase().includes(query)
    );
    const visibleCourses = matchingCourses.slice(0, visibleCount);

    return(
        <div>
        <h2>Completed Mt. SAC courses</h2>
        <label htmlFor="course-search">Search by course code or title</label>
        <input
          id="course-search"
          type="search"
          value={search}
          onChange={event => {
            setSearch(event.target.value);
            setVisibleCount(100);
          }}
          disabled={isLoading || error !== null}
        />
        {isLoading && <p role="status">Loading courses...</p>}
        {error && <p role="alert">{error}</p>}
        {!isLoading && !error && (
          <p>Showing {visibleCourses.length} of {matchingCourses.length} matching courses.</p>
        )}
        {
        visibleCourses.map(course => (
            <div key={course.id}>
            <label
            className="block">
            <input type="checkbox" 
            checked={completedCourses.includes(course.code)}
            onChange={event => onCourseChange(course.code, event.target.checked)}
            />
            {course.code} - {course.title}
            </label>
            <details>
              <summary>Course details</summary>
              <p>
                Units: {course.minUnits === course.maxUnits
                  ? course.minUnits : `${course.minUnits}–${course.maxUnits}`}
              </p>
              <p>UC transferable: {course.ucTransferable ? "Yes" : "No"}</p>
              <p>CSU transferable: {course.csuTransferable ? "Yes" : "No"}</p>
              {course.description && <p>{course.description}</p>}
              {course.requirements.map((requirement, index) => (
                <div key={index}>
                  <p>{requirement.type}: {requirement.text}</p>
                  {requirement.referencedCourses.length > 0 && (
                    <p>Referenced courses: {requirement.referencedCourses.join(", ")}</p>
                  )}
                </div>
              ))}
            </details>
            </div>
          ))
        }
        {!isLoading && !error && matchingCourses.length === 0 && (
          <p>{courses.length === 0 ? "No courses have been added yet." : "No courses match your search."}</p>
        )}
        {visibleCount < matchingCourses.length && (
          <button type="button" onClick={() => setVisibleCount(count => count + 100)}>
            Show more courses
          </button>
        )}
        <p>{completedCourses.length === 0 ? "No completed courses selected": 
          completedCourses.join(", ")
        }</p>
        <button
          type="button"
          onClick={onClearCourses}
          disabled={completedCourses.length === 0}
        >
          Clear completed courses
        </button>
        </div>
    )
}
