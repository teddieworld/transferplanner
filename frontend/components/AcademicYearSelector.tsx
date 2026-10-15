"use client";

import { useRemoteData } from "@/lib/use-remote-data";

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
  const url = selectedUniversity && selectedMajor
    ? `/api/academic-years?${new URLSearchParams({
        university: selectedUniversity, major: selectedMajor
      })}`
    : null;
  const { data, isLoading, error } = useRemoteData<string[]>(url);
  const availableYears = data ?? [];

  return (
    <div className="form-field">
      <label htmlFor="academic-year">Agreement year</label>
      <select
        id="academic-year"
        value={selectedAcademicYear}
        onChange={event => onAcademicYearChange(event.target.value)}
        disabled={isLoading || error !== null || availableYears.length === 0}
      >
        <option value="">{isLoading ? "Loading years..." : selectedMajor ? "Choose a year" : "Choose a major first"}</option>
        {availableYears.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      {selectedUniversity !== "" && selectedMajor !== "" && !isLoading && !error && availableYears.length === 0 && (
        <p>No academic years have been added for this major yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
