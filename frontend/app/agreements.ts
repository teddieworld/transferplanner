import type { MajorAgreement } from "@/lib/planner";
import { berkeleyCsAgreement } from "@/data/berkeleyCs";

export const agreements: MajorAgreement[] = [
    berkeleyCsAgreement
];

export const universities = [
    ...new Set(agreements.map(agreement => agreement.university))
];