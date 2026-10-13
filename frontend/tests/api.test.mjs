import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.TRANSFERPLANNER_TEST_URL || "http://localhost:3000";
const university = "University of California, Berkeley";
const major = "Computer Science, B.A.";

async function request(path, params = {}) {
  const url = new URL(path, base);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: await response.json() };
}

test("live database supplies universities, majors, years, and the complete Berkeley plan", async () => {
  const universities = await request("/api/universities");
  assert.equal(universities.status, 200);
  assert.ok(universities.body.some(item => item.name === university));

  const majors = await request("/api/majors", { university });
  assert.equal(majors.status, 200);
  assert.ok(majors.body.some(item => item.name === major));
  const emptyMajors = await request("/api/majors", { university: "University of California, Los Angeles" });
  assert.deepEqual(emptyMajors.body, []);

  const years = await request("/api/academic-years", { university, major });
  assert.equal(years.status, 200);
  assert.ok(years.body.includes("2026–2027"));

  const agreement = await request("/api/agreement", { university, major, year: "2026–2027" });
  assert.equal(agreement.status, 200);
  assert.equal(agreement.body.academicYear, "2026–2027");
  assert.deepEqual(agreement.body.requiredGroups.map(group => group.requiredCount), [null, 1]);
  const requirements = agreement.body.requiredGroups.flatMap(group => group.requirements);
  assert.equal(requirements.length, 4);
  assert.deepEqual(requirements.find(item => item.name === "MATH 54").options, [
    ["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]
  ]);
  assert.equal(requirements.find(item => item.name === "MATH 56").articulationStatus, "no_course_articulated");
  const recommendations = agreement.body.highlyRecommendedGroups.flatMap(group => group.requirements);
  assert.equal(recommendations.length, 4);
  assert.equal(recommendations.find(item => item.name === "COMPSCI 61B").articulationStatus, "partial");
  assert.ok(recommendations.find(item => item.name === "COMPSCI 61B").note);
  assert.equal(recommendations.find(item => item.name === "COMPSCI 70").articulationStatus, "university_only");
});

test("catalog exposes real units, descriptions, transferability and prerequisite links", async () => {
  const courses = await request("/api/courses");
  assert.equal(courses.status, 200);
  assert.ok(courses.body.length > 7);
  for (const code of ["MATH 180", "MATH 181", "ENGR 285", "MATH 285", "MATH 260", "MATH 290", "CSCI 240"]) {
    const course = courses.body.find(item => item.code === code);
    assert.ok(course, `Missing ${code}`);
    assert.equal(typeof course.minUnits, "number");
    assert.equal(typeof course.ucTransferable, "boolean");
    assert.ok(Array.isArray(course.requirements));
  }
  const withPrerequisites = courses.body.find(course => course.requirements.some(item => item.referencedCourses.length > 0));
  assert.ok(withPrerequisites);
  assert.ok(courses.body.some(course => course.description));
});

test("missing inputs, unsupported years and SQL-like input return safe responses", async () => {
  for (const path of ["/api/majors", "/api/academic-years", "/api/agreement"]) {
    assert.equal((await request(path)).status, 400);
  }
  assert.equal((await request("/api/agreement", { university, major, year: "1900–1901" })).status, 404);
  const injection = await request("/api/majors", { university: "' OR 1=1 --" });
  assert.equal(injection.status, 200);
  assert.deepEqual(injection.body, []);
});
