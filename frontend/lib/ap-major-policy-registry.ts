import { BERKELEY_AP_POLICIES } from "./ap-major-policies";
import { UCLA_AP_POLICIES } from "./ucla-ap-major-policies";
import { UCSD_AP_POLICIES } from "./ucsd-ap-major-policies";
import type { MajorAgreement } from "./planner";

export function getAPMajorPolicy(agreement: MajorAgreement) {
  if (agreement.university === "University of California, Berkeley" && agreement.academicYear === "2026–2027") {
    return BERKELEY_AP_POLICIES[agreement.major.trim()];
  }
  if (agreement.university === "University of California, Los Angeles" && agreement.academicYear === "2025–2026") {
    return UCLA_AP_POLICIES[agreement.major.trim()];
  }
  if (agreement.university === "University of California, San Diego" && agreement.academicYear === "2026–2027") {
    return UCSD_AP_POLICIES[agreement.major.trim()];
  }
}
