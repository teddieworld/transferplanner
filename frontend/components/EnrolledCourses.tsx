import type { CourseCatalogEntry } from "@/lib/catalog-types";
import type { CoursePatternReviews } from "@/lib/seven-course-pattern";
import { completionTerm, formatTerm } from "@/lib/course-approval";

export default function EnrolledCourses({ codes, catalog, reviews }: {
  codes: string[]; catalog: CourseCatalogEntry[]; reviews: CoursePatternReviews;
}) {
  if (!codes.length) return null;
  return <section className="enrolled-course-summary" aria-labelledby="enrolled-courses-heading">
    <h3 id="enrolled-courses-heading">Currently enrolled</h3>
    <p>Not counted yet. Add final grades when completed, then regenerate your plan.</p>
    <ul>{codes.map(code => {
      const course = catalog.find(item => item.code === code);
      const term = completionTerm(reviews[code]);
      return <li key={code}><strong>{code}</strong>{course && ` — ${course.title}`}<span>{term ? `${formatTerm(term)} · ` : ""}In progress</span></li>;
    })}</ul>
  </section>;
}
