import "server-only";

import { pool } from "./db";
import { buildAgreement } from "./agreement-builder";
import type { AgreementRow } from "./agreement-builder";
import type { CourseCatalogEntry, Major, University } from "./catalog-types";
import type { MajorAgreement } from "./planner";

export async function getUniversities(): Promise<University[]> {
  const result = await pool.query<University>("SELECT id, name FROM universities ORDER BY name");
  return result.rows;
}

export async function getMajors(university: string): Promise<Major[]> {
  const result = await pool.query<Major>(`
    SELECT m.id, m.name FROM majors m
    JOIN universities u ON u.id = m.university_id
    WHERE u.name = $1 ORDER BY m.name
  `, [university]);
  return result.rows;
}

export async function getAcademicYears(university: string, major: string, college: string): Promise<string[]> {
  const result = await pool.query<{ academicYear: string }>(`
    SELECT DISTINCT a.academic_year AS "academicYear"
    FROM articulation_agreements a
    JOIN majors m ON m.id = a.major_id
    JOIN universities u ON u.id = m.university_id
    JOIN colleges c ON c.id = a.college_id
    WHERE u.name = $1 AND m.name = $2 AND c.name = $3
    ORDER BY "academicYear" DESC
  `, [university, major, college]);
  return result.rows.map(row => row.academicYear);
}

export async function getCourses(college: string): Promise<CourseCatalogEntry[]> {
  const result = await pool.query<CourseCatalogEntry>(`
    SELECT c.id, c.code, c.title,
      c.min_units::double precision AS "minUnits",
      c.max_units::double precision AS "maxUnits",
      c.uc_transferable AS "ucTransferable", c.csu_transferable AS "csuTransferable",
      c.description,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'type', cr.requirement_type, 'text', cr.raw_text,
          'referencedCourses', COALESCE((
            SELECT jsonb_agg(referenced.code ORDER BY referenced.code)
            FROM requirement_courses rc
            JOIN courses referenced ON referenced.id = rc.referenced_course_id
            WHERE rc.requirement_id = cr.id
          ), '[]'::jsonb)
        ) ORDER BY cr.id)
        FROM course_requirements cr WHERE cr.course_id = c.id
      ), '[]'::jsonb) AS requirements
    FROM courses c JOIN colleges college ON college.id = c.college_id
    WHERE college.name = $1 ORDER BY c.code
  `, [college]);
  return result.rows;
}

export async function getAgreement(
  university: string, major: string, academicYear: string, college: string
): Promise<MajorAgreement | null> {
  const result = await pool.query<{ id: number; university: string; major: string; academicYear: string;
    metadata: {kind?: "structured" | "informational"; notes?: string[]; reviewNotes?: string[]} }>(`
    SELECT a.id, u.name AS university, m.name AS major, a.academic_year AS "academicYear", a.planner_metadata AS metadata
    FROM articulation_agreements a
    JOIN majors m ON m.id = a.major_id
    JOIN universities u ON u.id = m.university_id
    JOIN colleges c ON c.id = a.college_id
    WHERE u.name = $1 AND m.name = $2 AND a.academic_year = $3 AND c.name = $4
  `, [university, major, academicYear, college]);
  const agreement = result.rows[0];
  if (!agreement) return null;

  const rows = await pool.query<AgreementRow>(`
    SELECT g.id AS "groupId", g.group_name AS "groupName",
      g.requirement_category AS category, g.required_count AS "requiredCount",
      r.id AS "requirementId", r.requirement_text AS "requirementName",
      r.articulation_status AS "articulationStatus", r.note,
      r.preparation_note AS "preparationNote",
      r.department, g.rules,
      o.id AS "optionId", o.option_kind AS "optionKind",
      o.option_number AS "optionNumber", c.code AS "courseCode"
    FROM major_requirement_groups g
    JOIN articulation_agreements a ON a.id = g.agreement_id
    LEFT JOIN major_requirements r ON r.group_id = g.id
    LEFT JOIN major_requirement_options o ON o.major_requirement_id = r.id
    LEFT JOIN major_requirement_option_courses oc ON oc.option_id = o.id
    LEFT JOIN courses c ON c.id = oc.course_id AND c.college_id = a.college_id
    WHERE g.agreement_id = $1
    ORDER BY g.requirement_category, g.group_name, g.id, r.id, o.option_kind, o.option_number, c.code
  `, [agreement.id]);
  return buildAgreement({
    university: agreement.university, major: agreement.major, academicYear: agreement.academicYear,
    ...agreement.metadata
  }, rows.rows);
}
