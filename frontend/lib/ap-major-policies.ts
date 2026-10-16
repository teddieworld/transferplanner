// Reviewed 2026-10-15 against the 2026–27 Berkeley ASSIST agreements in
// transferplanner/data/generated, general_information (exam-credit sections).
// These are major-preparation exceptions, NOT Mt. SAC course equivalencies.
// Keep exact campus, major and agreement-year scope; never infer rules from titles.
export type APMajorRule = {
  covers: string[];
  exams: { id: string; minimum: number; subscore?: boolean }[];
  collegeOptions?: string[][];
  source: string;
  note?: string;
};
export type APMajorPolicy = { rules: APMajorRule[]; note?: string; maxExamGroups?: number };

const assist = "https://assist.org/transfer/results?year=77&institution=62&agreement=79&agreementType=to&view=agreement&viewBy=major";
const math = "https://math.berkeley.edu/courses/choosing/high-school-exam-credits";
const engineering = "https://engineering.berkeley.edu/students/undergraduate-guide/exams/";
const rule = (id: string, minimum: number, covers: string[], source = assist, note?: string): APMajorRule => ({
  exams: [{ id, minimum }], covers, source, ...(note ? { note } : {}),
});
const calculus = (bcMinimum = 5, source = assist) => [
  rule("calculus-ab", 3, ["MATH 51"], source),
  rule("calculus-bc", 3, ["MATH 51"], source),
  rule("calculus-bc", bcMinimum, ["MATH 51", "MATH 52"], source),
];
const economics: APMajorRule = {
  covers: ["ECON 1"], exams: [{ id: "microeconomics", minimum: 4 }, { id: "macroeconomics", minimum: 4 }], source: assist,
  note: "Both Economics exams must have a score of at least 4.",
};
const readingA = "Courses that satisfy Reading & Composition A";
const readingB = "Courses that satisfy Reading & Composition B";
const chemistryReading = [
  rule("english-language", 4, [readingA]),
  rule("english-literature", 4, [readingA]),
  rule("english-literature", 5, [readingA, readingB]),
];

export const BERKELEY_AP_POLICIES: Record<string, APMajorPolicy> = {
  "Computer Science, B.A.": { rules: calculus() },
  "Mathematics/Applied Mathematics, B.A.": { rules: calculus(5, math) },
  "Data Science, B.A.": { rules: calculus(5, "https://cdss.berkeley.edu/dsus/academics/majorrequirements"), note: "Data Science accepts exam credit for calculus only, not programming, linear algebra or domain emphasis." },
  "Astrophysics, B.A.": { rules: calculus() },
  "Statistics, B.A.": { rules: [...calculus(), rule("statistics", 3, ["STAT 2"])], note: "AP Statistics covers STAT 2 only; it does not replace the STAT 20 / DATA C8 lower-division requirement." },
  "Analytics, B.A.": { rules: [...calculus(4), economics] },
  "Economics, B.A.": { rules: [
    ...calculus().map(item => ({ ...item, covers: item.covers.flatMap(code => [code, code === "MATH 51" ? "MATH 16A" : "MATH 16B"]) })), economics,
    // MATH 181 individually articulates to MATH 52 in the same-year CS/Math
    // agreements; the Economics prose requires both calculus components.
    ...["calculus-ab", "calculus-bc"].map(id => ({ ...rule(id, 3, ["MATH 51", "MATH 52", "MATH 16A", "MATH 16B"]), collegeOptions: [["MATH 181"]], note: "Calculus I AP credit plus college MATH 181 (Calculus II) fulfills the calculus prerequisite." })),
    { ...rule("microeconomics", 4, ["ECON 1"]), collegeOptions: [["ECON C2002"], ["ECON C2002H"]], note: "AP Microeconomics plus completed college Macroeconomics fulfills the introductory Economics preparation." },
    { ...rule("macroeconomics", 4, ["ECON 1"]), collegeOptions: [["ECON C2001"], ["ECON C2001H"]], note: "AP Macroeconomics plus completed college Microeconomics fulfills the introductory Economics preparation." },
  ] },
  "Cognitive Science, B.A.": { rules: [
    rule("calculus-ab", 3, ["MATH 51", "MATH 16A"]), rule("calculus-bc", 3, ["MATH 51", "MATH 16A"]),
    rule("statistics", 3, ["STAT 2"]),
  ] },
  "Sociology, B.A.": { rules: [rule("statistics", 4, ["STAT 2"], assist, "Satisfies the Statistics/Logic prerequisite; an official AP score report is required.")] },
  "Social Welfare, B.A.": { rules: [rule("psychology", 3, ["PSYCH 1"])] },
  "Legal Studies, B.A.": { rules: [
    rule("statistics", 3, ["STAT 2"]),
    rule("microeconomics", 3, ["ECON 1"], assist, "Satisfies the Social/Behavioral Sciences prerequisite for this major only."),
    rule("government-us", 3, ["POL SCI 1"]),
    rule("european-history", 3, ["Other courses that satisfy the History requirement for the Legal Studies major"]),
    rule("us-history", 3, ["Other courses that satisfy the History requirement for the Legal Studies major"]),
  ] },
  "Political Economy, B.A.": { rules: [economics, rule("statistics", 3, ["STAT 2"])], note: "Foreign-language exam waivers require a separate language requirement review; they are not represented by this course checklist." },
  "Neuroscience, B.A.": { rules: [
    rule("biology", 5, ["BIOLOGY 1A", "BIOLOGY 1AL"]), rule("chemistry", 5, ["CHEM 1A", "CHEM 1AL"]),
    rule("calculus-bc", 5, ["MATH 51"]),
  ], note: "This major's agreement lists BC 5 for MATH 51 only. Chemistry exam credit does not cover CHEM 1B in the bundled articulation." },
  "Molecular and Cell Biology, B.A.": { rules: [
    rule("biology", 4, ["BIOLOGY 1A", "BIOLOGY 1AL", "BIOLOGY 1B"]), rule("chemistry", 4, ["CHEM 1A", "CHEM 1AL"]),
  ], note: "MCB discourages waiving college science courses with exam credit. Health-profession programs may require college coursework. CHEM 1B is not covered by AP Chemistry." },
  "Earth and Planetary Science, B.A.": { rules: [
    ...calculus(), rule("chemistry", 3, ["CHEM 1A", "CHEM 1AL"]), rule("chemistry", 4, ["CHEM 3A"]), rule("biology", 4, ["BIOLOGY 1A", "BIOLOGY 1B"]),
  ] },
  "Psychology, B.A.": { rules: [
    rule("psychology", 4, ["PSYCH 1"]),
    rule("biology", 4, ["BIOLOGY 1A", "BIOLOGY 1AL"], assist, "Fulfills the Biological Science prerequisite, not course equivalence."),
    rule("government-us", 4, ["POL SCI 1"]), rule("government-comparative", 4, ["POL SCI 2"]),
  ], maxExamGroups: 1, note: "Only one prerequisite may use AP/IB credit. The planner uses AP for the first still-unmet eligible group; the other prerequisites require college coursework. Quantitative requirements do not accept AP." },
};

for (const major of ["Chemical Biology, B.S.", "Chemical Engineering, B.S.", "Chemistry, B.A. and B.S."]) {
  BERKELEY_AP_POLICIES[major] = { rules: [...calculus(), ...chemistryReading] };
  if (major !== "Chemistry, B.A. and B.S.") BERKELEY_AP_POLICIES[major].rules.push(rule("biology", 4, ["BIOLOGY 1A", "BIOLOGY 1AL"]));
  // Engineering accepts Literature 4/5 for R&C A only, unlike the chemistry majors.
  if (major === "Chemical Engineering, B.S.") BERKELEY_AP_POLICIES[major].rules = BERKELEY_AP_POLICIES[major].rules.filter(item => !item.covers.includes(readingB));
}

// Exact majors whose ASSIST notes refer to the College of Engineering exam table.
for (const major of ["Aerospace Engineering, B.S.", "Bioengineering, B.S.", "Civil Engineering, B.S.", "Electrical Engineering & Computer Sciences, B.S.", "Electrical & Computer Engineering, B.S.", "Energy Engineering, B.S.", "Engineering Mathematics and Statistics, B.S.", "Engineering Physics, B.S.", "Environmental Engineering, B.S.", "Environmental Engineering Science, B.S.", "Industrial Engineering & Operations Research, B.S.", "Materials Science and Engineering, B.S.", "Mechanical Engineering, B.S.", "Nuclear Engineering, B.S."]) {
  const rules = [
    ...calculus(4, engineering),
    { ...rule("calculus-bc", 3, ["MATH 51"], engineering), exams: [{ id: "calculus-bc", minimum: 3, subscore: true }] },
    rule("chemistry", 4, ["CHEM 1A", "CHEM 1AL"], engineering),
    rule("physics-c-mechanics", 5, ["PHYSICS 7A"], engineering),
    rule("computer-science-principles", 3, ["COMPSCI 10"], engineering),
    rule("english-language", 4, [readingA], engineering), rule("english-literature", 4, [readingA], engineering),
  ];
  if (major !== "Civil Engineering, B.S.") rules.push(rule("biology", 4, ["BIOLOGY 1A", "BIOLOGY 1AL", "BIOLOGY 1B"], engineering));
  BERKELEY_AP_POLICIES[major] = { rules, note: "Engineering uses BC 4+ for MATH 52. AP Chemistry 3 is left for review because further chemistry requires college CHEM 1A/1AL. Civil Engineering's Basic Science Elective cannot use AP Biology. Exams must precede Berkeley enrollment." };
}

for (const major of ["American Studies, B.A.", "Chinese (East Asian Languages), B.A.", "Dance and Performance Studies, B.A.", "Dutch Studies, B.A.", "East Asian Religion, Thought, and Culture, B.A.", "Geography, B.A.", "History, B.A.", "Japanese (East Asian Languages), B.A.", "Korean Language and Culture (East Asian Languages), B.A.", "Media Studies, B.A.", "Native American Studies, B.A.", "Political Science, B.A.", "Theater and Performance Studies, B.A."]) {
  BERKELEY_AP_POLICIES[major] = { rules: [], note: "This major's ASSIST agreement does not accept AP exams toward major requirements." };
}
