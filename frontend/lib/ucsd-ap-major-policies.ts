import majors from "../data/ucsd-ap-major-scope-2026-2027.json";
import type { APMajorPolicy, APMajorRule } from "./ap-major-policies";

// Reviewed 2026-10-15. Use the university COURSE EXEMPTIONS (FOR USE ON MAJOR)
// column, not the eight residential colleges' different GE columns.
export const UCSD_AP_SOURCE = "https://catalog.ucsd.edu/_files/advanced-placement-credit-chart-2026.pdf";
const rule = (id: string, minimum: number, covers: string[], choice?: string, maximum?: number): APMajorRule => ({
  exams: [{ id, minimum, ...(maximum ? { maximum } : {}) }], covers, source: UCSD_AP_SOURCE,
  ...(choice ? { choice } : {}),
});
const rules: APMajorRule[] = [
  rule("biology", 3, ["BILD 10"], undefined, 3),
  rule("biology", 4, ["BILD 1", "BILD 2", "BILD 3"]),
  rule("chemistry", 3, ["CHEM 4"], undefined, 3),
  rule("chemistry", 4, ["CHEM 6A"], undefined, 4),
  rule("chemistry", 5, ["CHEM 6A", "CHEM 6B", "CHEM 6C"]),
  rule("computer-science-a", 4, ["CSE 8A"]),
  rule("computer-science-principles", 4, ["CSE 3"]),
  rule("microeconomics", 5, ["ECON 1"]), rule("macroeconomics", 5, ["ECON 3"]),
  rule("environmental-science", 4, ["ESYS 10"]),
  rule("government-us", 5, ["POLI 10"]), rule("government-comparative", 5, ["POLI 11"]),
  // One calculus pathway per exam family: a 20-series exemption must not
  // simultaneously fill a distinct 10-series choice in the same checklist.
  rule("calculus-ab", 3, ["MATH 10A"], "calculus-path"),
  rule("calculus-ab", 4, ["MATH 20A"], "calculus-path"),
  rule("calculus-bc", 3, ["MATH 20A"], "calculus-path"),
  rule("calculus-bc", 3, ["MATH 10A", "MATH 10B"], "calculus-path"),
  rule("calculus-bc", 4, ["MATH 20A", "MATH 20B"], "calculus-path"),
  rule("physics-1", 3, ["PHYS 10"]), rule("physics-2", 3, ["PHYS 10"]),
  rule("physics-c-mechanics", 3, ["PHYS 1A"], "mechanics-series"),
  rule("physics-c-mechanics", 4, ["PHYS 2A"], "mechanics-series"),
  rule("physics-c-electricity", 3, ["PHYS 1B"], "electricity-series"),
  rule("physics-c-electricity", 4, ["PHYS 2B"], "electricity-series"),
  rule("psychology", 4, ["PSYC 1"]),
  rule("latin", 3, ["LTLA 1", "LTLA 2", "LTLA 3"]),
];
for (const [id, prefix, literature] of [["french", "LIFR", "LTFR"], ["german", "LIGM", "LTGM"],
  ["italian", "LIIT", "LTIT"], ["spanish-language", "LISP", "LTSP"]]) {
  rules.push(rule(id, 3, [`${prefix} 1C`, `${prefix} 1CX`], undefined, 3),
    rule(id, 4, [`${prefix} 1D`, `${prefix} 1DX`], `language-${id}`, 4),
    rule(id, 4, [`${literature} 2A`], `language-${id}`, 4),
    rule(id, 5, [`${literature} 2B`]));
}
rules.push(rule("spanish-literature", 3, ["LISP 1D", "LISP 1DX"], "spanish-literature", 3),
  rule("spanish-literature", 3, ["LTSP 2A"], "spanish-literature", 3),
  rule("spanish-literature", 4, ["LTSP 2B"], undefined, 4), rule("spanish-literature", 5, ["LTSP 2C"]));

const policy: APMajorPolicy = { rules,
  unmatchedMessage: "No applicable UCSD major-course exemption matches these exams and scores.",
  examMessages: {
    statistics: "UCSD's AP chart assigns no major-course exemption for Statistics.",
    "english-language": "Entry-level writing credit does not replace a UCSD major course.",
    "english-literature": "Entry-level writing credit does not replace a UCSD major course.",
    "computer-science-a": "A score of 4–5 exempts CSE 8A, not CSE 11.",
    chinese: "Chinese course placement requires a department exam or interview.",
    japanese: "Japanese course placement requires a department exam or interview.",
    "us-history": "Two quarters of history credit are not assigned to specific HILD 2A/2B/2C courses.",
  }, note: "Only named major-course exemptions are applied. Chemistry labs, programming beyond the listed exemptions, placement interviews and residential-college GE are not waived. The reviewed chart is for 2026–27.",
};
// Exact current ASSIST program names prevent a newly imported major/year from
// silently inheriting an unreviewed policy scope.
export const UCSD_AP_POLICIES: Record<string, APMajorPolicy> = Object.fromEntries(majors.map(major => [major.trim(), policy]));

// These nine ASSIST agreements explicitly waive the fourth-quarter language
// requirement with language 4+ or literature 3+. This is a preparation waiver,
// not a claim that AP Chinese/Japanese assigns a university course number.
const isp = "https://assist.org/transfer/results?year=77&institution=62&agreement=7&agreementType=to&view=agreement&viewBy=major";
for (const major of ["International Studies - Anthropology B.A.", "International Studies - Economics B.A.",
  "International Studies - History B.A.", "International Studies - International Business B.A.",
  "International Studies - Linguistics B.A.", "International Studies - Literature B.A.",
  "International Studies - Philosophy B.A.", "International Studies - Political Science B.A.",
  "International Studies - Sociology  B.A."]) {
  const waivers: APMajorRule[] = [];
  for (const [id, prefix, literature] of [["french", "LIFR", "LTFR"], ["german", "LIGM", "LTGM"],
    ["italian", "LIIT", "LTIT"], ["spanish-language", "LISP", "LTSP"], ["spanish-literature", "LISP", "LTSP"]]) {
    const minimum = id === "spanish-literature" ? 3 : 4;
    for (const covers of [[`${prefix} 1D`, `${prefix} 1DX`], [`${literature} 2A`]]) {
      waivers.push({ ...rule(id, minimum, covers, id === "spanish-literature" ? id : `language-${id}`),
        source: isp, independentOfCourseMapping: true,
        note: "Satisfies the International Studies language preparation requirement; course placement is separate." });
    }
  }
  for (const [id, code] of [["chinese", "CHIN 20AN"], ["japanese", "JAPN 20A"]]) {
    waivers.push({ ...rule(id, 4, [code]), source: isp, independentOfCourseMapping: true,
      note: "International Studies language waiver only; a department placement exam may still be needed for enrollment." });
  }
  UCSD_AP_POLICIES[major.trim()] = { ...policy, rules: [...rules, ...waivers] };
}

// Departmental preparation waivers can differ from the campus course chart.
// Global Health accepts AP Statistics 3+ for the statistics choice, whereas
// Psychology explicitly rejects it for PSYC 60.
for (const major of ["Global Health B.A.", "Global Health B.S."]) {
  UCSD_AP_POLICIES[major] = { ...policy,
    rules: [...rules,
      { ...rule("statistics", 3, ["PSYC 60"]), source: "https://globalhealthprogram.ucsd.edu/undergraduate-program/major.html",
        note: "Global Health statistics preparation waiver; this is not general PSYC 60 course credit." }],
    note: "Global Health accepts Statistics AP 3+ for its statistics requirement. Chemistry laboratory requirements remain separate from AP lecture credit.",
  };
}
for (const major of majors.filter(name => name.startsWith("Psychology"))) {
  UCSD_AP_POLICIES[major.trim()] = { ...policy, examMessages: { ...policy.examMessages,
    psychology: "AP Psychology awards PSYC 1, which does not count toward a Psychology major.",
    statistics: "AP Statistics does not fulfill PSYC 60 or Psychology major statistics preparation.",
  }, note: "The Psychology Department excludes AP Psychology and AP Statistics from major preparation: https://psychology.ucsd.edu/undergraduate-program/new-students/freshmen/freshmen-faqs.html" };
}
