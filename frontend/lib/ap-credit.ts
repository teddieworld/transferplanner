// UC systemwide unit credit, checked 2026-10-15. Subject/major credit is campus-specific.
export const AP_CREDIT_SOURCE = "https://admission.universityofcalifornia.edu/admission-requirements/ap-exam-credits/ap-credits/";
export type APExam = { id: string; name: string; units: number; bucket?: string; note?: string };
export type APResult = { score: string; abSubscore?: string; excludeFromUnits?: boolean };
export type APResults = Record<string, APResult>;

export const AP_EXAMS: APExam[] = [
  { id: "african-american-studies", name: "African American Studies", units: 2.6, note: "UC credit available for exams after May 2025." },
  { id: "art-2d", name: "Art and Design: 2-D", units: 5.3, bucket: "art-design" },
  { id: "art-3d", name: "Art and Design: 3-D", units: 5.3, bucket: "art-design" },
  { id: "art-drawing", name: "Art and Design: Drawing", units: 5.3, bucket: "art-design" },
  { id: "art-history", name: "Art History", units: 5.3 },
  { id: "biology", name: "Biology", units: 5.3 },
  { id: "calculus-ab", name: "Calculus AB", units: 2.6, bucket: "calculus-ab" },
  { id: "calculus-bc", name: "Calculus BC", units: 5.3, bucket: "calculus-bc" },
  { id: "chemistry", name: "Chemistry", units: 5.3 },
  { id: "chinese", name: "Chinese Language and Culture", units: 5.3 },
  { id: "computer-science-a", name: "Computer Science A", units: 5.3 },
  { id: "computer-science-principles", name: "Computer Science Principles", units: 5.3 },
  { id: "english-language", name: "English Language and Composition", units: 5.3, bucket: "english" },
  { id: "english-literature", name: "English Literature and Composition", units: 5.3, bucket: "english" },
  { id: "environmental-science", name: "Environmental Science", units: 2.6 },
  { id: "european-history", name: "European History", units: 5.3 },
  { id: "french", name: "French Language and Culture", units: 5.3 },
  { id: "german", name: "German Language and Culture", units: 5.3 },
  { id: "government-comparative", name: "Government and Politics: Comparative", units: 2.6 },
  { id: "government-us", name: "Government and Politics: United States", units: 2.6 },
  { id: "human-geography", name: "Human Geography", units: 2.6 },
  { id: "italian", name: "Italian Language and Culture", units: 5.3 },
  { id: "japanese", name: "Japanese Language and Culture", units: 5.3 },
  { id: "latin", name: "Latin", units: 5.3 },
  { id: "macroeconomics", name: "Macroeconomics", units: 2.6 },
  { id: "microeconomics", name: "Microeconomics", units: 2.6 },
  { id: "music-theory", name: "Music Theory", units: 5.3, note: "Use the full exam score; Music Theory subscores alone do not earn UC credit." },
  { id: "physics-1", name: "Physics 1", units: 5.3, bucket: "physics" },
  { id: "physics-2", name: "Physics 2", units: 5.3, bucket: "physics" },
  { id: "physics-c-mechanics", name: "Physics C: Mechanics", units: 2.6, bucket: "physics" },
  { id: "physics-c-electricity", name: "Physics C: Electricity and Magnetism", units: 2.6, bucket: "physics" },
  { id: "precalculus", name: "Precalculus", units: 0, note: "UC awards no credit for the Precalculus exam (offered from 2024)." },
  { id: "psychology", name: "Psychology", units: 2.6 },
  { id: "research", name: "Research", units: 0, note: "No unit credit is listed in UC's AP credit table." },
  { id: "seminar", name: "Seminar", units: 0, note: "No unit credit is listed in UC's AP credit table." },
  { id: "spanish-language", name: "Spanish Language and Culture", units: 5.3 },
  { id: "spanish-literature", name: "Spanish Literature and Culture", units: 5.3 },
  { id: "statistics", name: "Statistics", units: 2.6 },
  { id: "us-history", name: "United States History", units: 5.3 },
  { id: "world-history", name: "World History: Modern", units: 5.3 }
];

function validScore(score: string | undefined) {
  return score !== undefined && /^[1-5]$/.test(score);
}

export function getAPExamUnits(exam: APExam, result: APResult): number {
  if (!validScore(result.score)) return 0;
  if (Number(result.score) >= 3) return exam.units;
  if (exam.id === "calculus-bc" && validScore(result.abSubscore) && Number(result.abSubscore) >= 3) return 2.6;
  return 0;
}

export function getAPCredit(results: APResults) {
  // Integer tenths avoid totals such as 7.899999999999999 from published decimal awards.
  const buckets = new Map<string, number>();
  let pendingCount = 0;
  let excludedCount = 0;
  for (const exam of AP_EXAMS) {
    const result = results[exam.id];
    if (!result) continue;
    if (result.excludeFromUnits) { excludedCount++; continue; }
    if (!validScore(result.score)) { pendingCount++; continue; }
    const units = getAPExamUnits(exam, result);
    // A qualifying AB subscore duplicates an AB exam; it is not additional BC credit.
    const bucket = exam.id === "calculus-bc" && units === 2.6 ? "calculus-ab" : exam.bucket ?? exam.id;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + Math.round(units * 10));
  }

  const capNotes: string[] = [];
  const limits = [
    ["art-design", 53, "Art and Design exams share a 5.3-unit maximum."],
    ["english", 53, "English exams share a 5.3-unit maximum."],
    ["physics", 53, "Physics exams share a 5.3-unit maximum."],
    ["calculus-ab", 26, "Calculus AB exam and BC AB-subscore credit count only once."]
  ] as const;
  for (const [bucket, limit, note] of limits) {
    if ((buckets.get(bucket) ?? 0) > limit) {
      buckets.set(bucket, limit);
      capNotes.push(note);
    }
  }
  const calculus = (buckets.get("calculus-ab") ?? 0) + (buckets.get("calculus-bc") ?? 0);
  buckets.delete("calculus-ab");
  buckets.delete("calculus-bc");
  if (calculus > 53) capNotes.push("Calculus AB and BC share a 5.3-unit maximum.");
  buckets.set("calculus", Math.min(calculus, 53));
  const units = [...buckets.values()].reduce((total, value) => total + value, 0) / 10;
  return { units, capNotes, pendingCount, excludedCount };
}
