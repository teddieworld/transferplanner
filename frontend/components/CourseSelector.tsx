"use client";

type CourseSelectorProps = {
    completedCourses : string[];
    onCourseChange : (courseCode:string, isChecked:boolean) => void;
    onClearCourses: () => void;
};

const courses = [
  { 
    code: "MATH 180", 
    title: "Calculus and Analytic Geometry I"
  },
  {
    code: "MATH 181",
    title: "Calculus and Analytic Geometry II"
  },
  {
    code: "ENGR 285",
    title: "Differential Equations and Linear Algebra for Engineers"
  },
  {
    code: "MATH 285",
    title: "Linear Algebra and Differential Equations"
  },
  {
    code: "MATH 260",
    title: "Linear Algebra"
  },
  {
    code: "MATH 290",
    title: "Differential Equations"
  },
    {
    code: "CSCI 240",
    title: "Data Structures and Algorithms"
  }
];

export default function CourseSelector({
    completedCourses,
    onCourseChange,
    onClearCourses
}:CourseSelectorProps)
{
    return(
        <div>
        {
        courses.map(course => 
            <label key={course.code}
            className="block">
            <input type="checkbox" 
            checked={completedCourses.includes(course.code)}
            onChange={event => onCourseChange(course.code, event.target.checked)}
            />
            {course.code} - {course.title}
            </label>
          )
        }
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