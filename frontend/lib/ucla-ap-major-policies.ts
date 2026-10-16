import type { APMajorPolicy, APMajorRule } from "./ap-major-policies";

// Reviewed 2026-10-15 against the 2025–26 Mt. SAC → UCLA ASSIST snapshots.
// Exact-major rules take priority over general campus unit/subject awards.
// The Samueli agreements explicitly delegate their exam rules to this table.
const assist = "https://assist.org/transfer/results?year=76&institution=62&agreement=117&agreementType=to&view=agreement&viewBy=major";
const engineering = "https://admission.ucla.edu/admitted-students/ap-credit-engineering";
const college = "https://admission.ucla.edu/admitted-students/ap-credit-the-college";
const rule = (id: string, minimum: number, covers: string[], source = assist, note?: string): APMajorRule => ({
  exams: [{ id, minimum }], covers, source, ...(note ? { note } : {}),
});
const calculus = (source = assist, bcFirstMinimum = 4) => [
  rule("calculus-ab", 5, ["MATH 31A"], source),
  rule("calculus-bc", bcFirstMinimum, ["MATH 31A"], source),
  rule("calculus-bc", 5, ["MATH 31A", "MATH 31B"], source),
];
const economics = () => ["microeconomics", "macroeconomics"].flatMap((id, index) => [
  rule(id, 5, [`ECON ${index + 1}`]),
  { ...rule(id, 4, [`ECON ${index + 1}`]), exams: [{ id, minimum: 4, maximum: 4, beforeYear: 2021 }] },
]);
const economicDates = {
  microeconomics: "UCLA ECON 1 needs 5, or 4 on an exam before May 2021. Enter the exam year for a score of 4.",
  macroeconomics: "UCLA ECON 2 needs 5, or 4 on an exam before May 2021. Enter the exam year for a score of 4.",
};
const statsWaiver = (minimum: number, covers: string[]) => rule("statistics", minimum, covers, assist,
  "Satisfies this major's statistics preparation choice; this is not general UCLA course equivalence.");
const prepOnly = "Satisfies this major's preparation choice; this is not general UCLA course equivalence.";
const languageWaiver = "Elementary and Intermediate Levels (Six Terms) Of One Foreign Language";
const languageExams = ["chinese", "french", "german", "italian", "japanese", "spanish-language", "spanish-literature"];

export const UCLA_AP_POLICIES: Record<string, APMajorPolicy> = {};

for (const major of ["Applied Mathematics/B.S.", "Computational Biology/B.S.", "Data Theory/B.S.",
  "Financial Actuarial Mathematics/B.S.", "Human Biology and Society/B.S.",
  "Linguistics and Computer Science/B.A.", "Mathematics/Applied Science/B.S.", "Mathematics/B.S.",
  "Mathematics/Economics/B.S.", "Mathematics for Teaching/B.S.", "Mathematics of Computation/B.S.",
  "Microbiology, Immunology, and Molecular Genetics/B.S.", "Molecular, Cell, and Developmental Biology/B.S.",
  "Neuroscience/B.S."]) {
  UCLA_AP_POLICIES[major] = { rules: calculus() };
}
for (const major of ["Biochemistry/B.S.", "Chemistry/B.S.", "Chemistry/Materials Science/B.S."]) {
  UCLA_AP_POLICIES[major] = { rules: [...calculus(), rule("chemistry", 4, ["CHEM 20A"])],
    note: "Chemistry AP covers CHEM 20A only; other chemistry courses and labs still apply." };
}
for (const major of ["Astrophysics/B.S.", "Biophysics/B.S.", "Physics/B.A.", "Physics/B.S."]) {
  UCLA_AP_POLICIES[major] = { rules: [...calculus(assist, 5),
    rule("physics-c-mechanics", 4, ["PHYSICS 1A"]), rule("chemistry", 4, ["CHEM 20A"])],
    note: "These major agreements list BC 5 for calculus credit. AP Physics covers PHYSICS 1A only, not the whole physics sequence." };
}
for (const major of ["Aerospace  Engineering/B.S", "Bioengineering/B.S.", "Chemical Engineering/ B.S",
  "Civil Engineering/B.S.", "Computer Engineering/B.S.", "Computer Science and Engineering/B.S.",
  "Computer Science/B.S.", "Electrical Engineering/B.S.", "Materials Engineering/B.S.", "Mechanical Engineering/B.S."]) {
  UCLA_AP_POLICIES[major.trim()] = { rules: [...calculus(engineering),
    rule("chemistry", 4, ["CHEM 20A"], engineering), rule("physics-c-mechanics", 4, ["PHYSICS 1A"], engineering),
    rule("english-language", 4, ["ENGCOMP 3"], engineering), rule("english-literature", 4, ["ENGCOMP 3"], engineering),
    rule("psychology", 4, ["PSYCH 10"], engineering),
  ], note: "Samueli allows eligible math, chemistry and mechanics scores to be elected as course credit. Unassigned AP credit does not replace COM SCI 31 or the rest of a science/lab sequence." };
}
for (const major of ["Economics/B.A.", "Business Economics/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: [...calculus(), ...economics()], examMessages: economicDates };
}
for (const major of ["American Literature and Culture/B.A.", "English/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: [rule("english-language", 4, ["ENGCOMP 3"]), rule("english-literature", 4, ["ENGCOMP 3"])] };
}
UCLA_AP_POLICIES["Comparative Literature/B.A."] = { rules: [
  rule("english-language", 4, ["Writing I Courses"]), rule("english-literature", 4, ["Writing I Courses"]),
] };
for (const major of ["Applied Linguistics/B.A.", "Linguistics/B.A.", "Linguistics and Psychology/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: [rule("psychology", 4, ["PSYCH 10"])] };
}
UCLA_AP_POLICIES["Sociology/B.A."] = { rules: [statsWaiver(3, ["STATS 10"])] };
UCLA_AP_POLICIES["Disability Studies/B.A."] = { rules: [statsWaiver(3, ["STATS 10"])] };
UCLA_AP_POLICIES["Statistics and Data Science/B.S."] = { rules: [...calculus(), statsWaiver(4, ["STATS 10"])] };
UCLA_AP_POLICIES["Psychobiology/B.S."] = { rules: [...calculus(), rule("psychology", 4, ["PSYCH 10"]), statsWaiver(3, ["STATS 13"])],
  note: "Calculus AP covers the MATH 31A/31B path. Other calculus, biology and laboratory requirements are not waived." };
UCLA_AP_POLICIES["Cognitive Science/B.S."] = { rules: [...calculus(), rule("psychology", 4, ["PSYCH 10"]),
  rule("biology", 3, ["LIFESCI 7A"], assist, prepOnly),
  rule("chemistry", 3, ["Introductory Chemistry Courses"], assist, prepOnly),
  ...["physics-1", "physics-2", "physics-c-mechanics", "physics-c-electricity"].map(id => rule(id, 3, ["PHYSICS 10"], assist, prepOnly)),
] };
UCLA_AP_POLICIES["Psychology/B.A."] = { rules: [rule("psychology", 4, ["PSYCH 10"]),
  rule("biology", 3, ["Lower Division Biology Courses"], assist, prepOnly),
  rule("chemistry", 3, ["Introductory Chemistry Courses"], assist, prepOnly),
  ...["physics-1", "physics-2", "physics-c-mechanics", "physics-c-electricity"].map(id => rule(id, 3, ["PHYSICS 10"], assist, prepOnly)),
  statsWaiver(3, ["Introductory Statistics Courses"]),
  ...["calculus-ab", "calculus-bc"].map(id => rule(id, 3, ["Calculus Requirement"], assist, prepOnly)),
] };
UCLA_AP_POLICIES["Public Health/B.A."] = { rules: [
  rule("biology", 4, ["LIFESCI 7A"], assist, prepOnly), rule("chemistry", 4, ["Introductory Chemistry Courses"], assist, prepOnly),
] };
const international = () => [...economics(), rule("government-comparative", 3, ["POL SCI 50"]),
  rule("human-geography", 3, ["GEOG 3"]), rule("world-history", 3, ["HIST 22"])];
for (const major of ["Asian Studies/B.A.", "European Studies/B.A.", "Latin American Studies/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: international(), examMessages: economicDates };
}
UCLA_AP_POLICIES["African and Middle Eastern Studies/B.A."] = { rules: [rule("government-comparative", 3, ["POL SCI 50"])] };
for (const major of ["Global Studies/B.A.", "International Development Studies/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: [...international(), statsWaiver(3, ["STATS 10"]),
    ...languageExams.map(id => rule(id, 3, [languageWaiver], assist, "Major-preparation language waiver; additional language study may be required after transfer.")),
  ], examMessages: economicDates };
}
for (const major of ["Chicana and Chicano Studies/B.A.", "Latin American Studies/B.A."]) {
  const policy = UCLA_AP_POLICIES[major] ?? { rules: [] };
  policy.rules.push(rule("spanish-language", 5, ["SPAN 5"]));
  UCLA_AP_POLICIES[major] = policy;
}
UCLA_AP_POLICIES["European Languages and Transcultural Studies with French and Francophone/B.A."] = {
  rules: [rule("french", 5, ["FRNCH 6"], college)], note: "Language placement and any additional major conditions still apply.",
};
UCLA_AP_POLICIES["European Languages and Transcultural Studies with Italian/B.A."] = {
  rules: [rule("italian", 5, ["ITALIAN 6"], college)], note: "Language placement and any additional major conditions still apply.",
};
UCLA_AP_POLICIES["Communication/B.A."] = { rules: [
  rule("statistics", 4, ["STATS 10"]), rule("psychology", 4, ["PSYCH 10"]), rule("microeconomics", 4, ["ECON 1"]),
].map(item => ({ ...item, reviewNote: "Communication requires four major-prep courses passed with letter grades by the end of fall before AP may cover the remaining courses. This condition is not verified by the planner." })),
  unmatchedMessage: "Communication AP credit depends on its four-course fall deadline condition.",
};
for (const major of ["Ancient Near East and Egyptology/B.A.", "Asian American Studies/B.A.",
  "Central and East European Languages and Cultures/B.A.", "Education and Social Transformation/B.A.",
  "Human Biology and Society/B.A.", "Iranian Studies/B.A.", "Jewish Studies/B.A.", "Labor Studies/B.A.", "Public Affairs/B.A."]) {
  UCLA_AP_POLICIES[major] = { rules: [], note: "This major's ASSIST agreement excludes AP from major preparation." };
}
for (const [major, message] of [
  ["Art History/B.A.", "AP Art History does not satisfy this major's preparation."],
  ["History/B.A.", "AP History does not satisfy this major's preparation."],
  ["Political Science/B.A.", "AP Government and Statistics do not satisfy this major's preparation."],
  ["Philosophy/B.A.", "No reviewed AP substitution is listed for this major's preparation."],
]) UCLA_AP_POLICIES[major] = { rules: [], unmatchedMessage: message };
