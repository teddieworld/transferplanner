"use client";

import { agreements } from "@/app/agreements";

type AcademicYearSelectorProps = {
  selectedUniversity: string;
  selectedMajor: string;
  selectedAcademicYear: string;
  onAcademicYearChange: (value: string) => void;
};

export default function AcademicYearSelector({
  selectedUniversity,
  selectedMajor,
  selectedAcademicYear,
  onAcademicYearChange
}: AcademicYearSelectorProps) {
  const availableYears = [
    ...new Set(
      agreements
        .filter(agreement =>
          agreement.university === selectedUniversity &&
          agreement.major === selectedMajor
        )
        .map(agreement => agreement.academicYear)
    )
  ].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <label htmlFor="academic-year">Select an academic year</label>
      <select
        id="academic-year"
        value={selectedAcademicYear}
        onChange={event => onAcademicYearChange(event.target.value)}
        disabled={availableYears.length === 0}
      >
        <option value="">Select an academic year</option>
        {availableYears.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      {selectedUniversity !== "" && selectedMajor !== "" && availableYears.length === 0 && (
        <p>No academic years have been added for this major yet.</p>
      )}
    </div>
  );
}
