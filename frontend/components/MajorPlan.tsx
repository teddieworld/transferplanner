"use client";

type MajorPlanProps = {
    completedCourses: string[];
};

export default function MajorPlan({
    completedCourses
}: MajorPlanprops)
{
    const isMath51Satisfied = completedCourses.includes("MATH 180"); //contains a boolean if completedCourses says MATH 180 is completed
    const isMath52Satisfied = completedCourses.includes("MATH 181"); //contains a boolean if completedCourses says MATH 181 is completed
    const isRequiredGroupASatisfied = isMath51Satisfied && isMath52Satisfied;
    const isMath54Satisfied = completedCourses.includes("ENGR 285") || completedCourses.includes("MATH 285") 
    || (completedCourses.includes("MATH 260") && completedCourses.includes("MATH 290"));
    const isRequiredGroupBSatisfied = isMath54Satisfied;
    const isRequiredCategorySatisfied = isRequiredGroupASatisfied && isRequiredGroupBSatisfied;
    const compSci61BStatus= completedCourses.includes("CSCI 240") ? "Partial" : "Not satisfied";
    return(
        <div>
            <h2>
              Required
            </h2>
            <p>
              MATH 51: {isMath51Satisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              MATH 52: {isMath52Satisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              Required Group A: {isRequiredGroupASatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              MATH 54: {isMath54Satisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              MATH 56: No course articulated
            </p>
            <p>
              Required Group B: {isRequiredGroupBSatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <p>
              Required preparation: {isRequiredCategorySatisfied ? "Satisfied" : "Not satisfied"}
            </p>
            <h2>
              Highly recommended
            </h2>
            <p>
              COMPSCI 61A: No course articulated
            </p>
            <p>
              COMPSCI 61B: {compSci61BStatus}
            </p>
            <p>
              COMPSCI 61C: No course articulated
            </p>
            <p>
              COMPSCI 70: University only
            </p>
        </div>
    )
}