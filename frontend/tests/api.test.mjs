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
  const emptyMajors = await request("/api/majors", { university: "University of California, Davis" });
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
  const math54 = requirements.find(item => item.name === "MATH 54");
  assert.deepEqual(requirements.find(item => item.name === "MATH 51").receivingCourses,
    [{ code: "MATH 51", title: "Calculus I" }]);
  assert.ok(requirements.find(item => item.name === "MATH 51").optionCourseTitles["MATH 180"]);
  assert.deepEqual(math54.receivingCourses,
    [{ code: "MATH 54", title: "Linear Algebra and Differential Equations" }]);
  assert.deepEqual(math54.options, [
    ["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]
  ]);
  assert.deepEqual(math54.preparationOptions, [["ENGR 285"], ["MATH 285"], ["MATH 260"]]);
  assert.match(math54.preparationNote, /Linear Algebra/);
  assert.equal(requirements.find(item => item.name === "MATH 56").articulationStatus, "no_course_articulated");
  const recommendations = agreement.body.highlyRecommendedGroups.flatMap(group => group.requirements);
  assert.equal(recommendations.length, 4);
  assert.equal(recommendations.find(item => item.name === "COMPSCI 61B").articulationStatus, "partial");
  assert.ok(recommendations.find(item => item.name === "COMPSCI 61B").note);
  assert.equal(recommendations.find(item => item.name === "COMPSCI 70").articulationStatus, "university_only");
});

test("UCLA and UC San Diego expose campus-specific majors, years and full agreements", async () => {
  for (const [university, major, year, expectedCount, receivingCode, collegeCode] of [
    ["University of California, Los Angeles", "Computer Science/B.S.", "2025–2026", 134, "MATH 31A", "MATH 180"],
    ["University of California, San Diego", "CSE: Computer Science B.S.", "2026–2027", 158, "CSE 11", "CSCI 145"],
  ]) {
    const majors = await request("/api/majors", { university });
    assert.equal(majors.status, 200);
    assert.equal(majors.body.length, expectedCount);
    assert.ok(majors.body.some(item => item.name === major));
    assert.ok(majors.body.every(item => !/\bminor\b/i.test(item.name)));
    const years = await request("/api/academic-years", { university, major });
    assert.deepEqual(years.body, [year]);
    const agreement = await request("/api/agreement", { university, major, year });
    assert.equal(agreement.status, 200);
    assert.equal(agreement.body.university, university);
    assert.equal(agreement.body.major, major);
    const requirements = [...agreement.body.requiredGroups, ...agreement.body.majorRequiredGroups,
      ...agreement.body.highlyRecommendedGroups].flatMap(group => group.requirements);
    const requirement = requirements.find(item => item.name === receivingCode);
    assert.ok(requirement.receivingCourses[0].title);
    assert.ok(requirement.options.some(option => option.includes(collegeCode)));
    assert.ok(requirement.optionCourseTitles[collegeCode]);
  }
});

test("Mathematics is selectable with its own year, alternatives and recommendation", async () => {
  const mathMajor = "Mathematics/Applied Mathematics, B.A.";
  const majors = await request("/api/majors", { university });
  assert.equal(majors.status, 200);
  assert.ok(majors.body.some(item => item.name === mathMajor));
  const years = await request("/api/academic-years", { university, major: mathMajor });
  assert.equal(years.status, 200);
  assert.ok(years.body.includes("2026–2027"));
  const agreement = await request("/api/agreement", { university, major: mathMajor, year: "2026–2027" });
  assert.equal(agreement.status, 200);
  assert.equal(agreement.body.major, mathMajor);
  assert.deepEqual(agreement.body.requiredGroups.map(group => group.requiredCount), [null, 1]);
  const requirements = agreement.body.requiredGroups.flatMap(group => group.requirements);
  assert.deepEqual(requirements.map(item => item.name), ["MATH 51", "MATH 52", "MATH 53", "MATH 54", "MATH 56"]);
  assert.deepEqual(requirements.slice(0, 3).map(item => item.options), [
    [["MATH 180"]], [["MATH 181"]], [["MATH 280"]]
  ]);
  const math54 = requirements.find(item => item.name === "MATH 54");
  assert.deepEqual(math54.options, [["ENGR 285"], ["MATH 285"], ["MATH 260", "MATH 290"]]);
  assert.equal(math54.preparationOptions, undefined);
  assert.equal(math54.preparationNote, undefined);
  const math56 = requirements.find(item => item.name === "MATH 56");
  assert.equal(math56.articulationStatus, "no_course_articulated");
  assert.deepEqual(math56.options, []);
  const recommended = agreement.body.highlyRecommendedGroups.flatMap(group => group.requirements);
  assert.deepEqual(recommended.map(item => item.name), ["MATH 55"]);
  assert.deepEqual(recommended[0].options, [["CSCI 190"]]);
});

test("new agreements separate admission, degree rules and informational guidance", async () => {
  for (const name of ["African American Studies, B.A.", "American Studies, B.A.", "Ancient Greek and Roman Civilizations, B.A."]) {
    const result = await request("/api/agreement", { university, major: name, year: "2026–2027" });
    assert.equal(result.status, 200, name);
    assert.ok(result.body.notes.length > 0);
    if (name === "African American Studies, B.A.") {
      assert.equal(result.body.requiredGroups[0].requirements.length, 3);
      assert.deepEqual(result.body.requiredGroups[0].requirements[0].options, [["HIST 35"]]);
    } else if (name === "American Studies, B.A.") {
      assert.deepEqual(result.body.requiredGroups, []);
      assert.equal(result.body.majorRequiredGroups.length, 2);
      assert.equal(result.body.majorRequiredGroups[0].reviewRequired, true);
      const choice = result.body.majorRequiredGroups[1];
      assert.equal(choice.requiredCount, 3);
      assert.equal(choice.maxPerDepartment, 2);
      assert.ok(choice.requirements.every(r => r.department));
    } else {
      assert.equal(result.body.kind, "informational");
      assert.deepEqual(result.body.requiredGroups, []);
      assert.deepEqual(result.body.majorRequiredGroups, []);
    }
  }
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
