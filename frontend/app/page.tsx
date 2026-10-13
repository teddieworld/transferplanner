"use client";

//cd frontend
//npm run dev


//the page that represents what is shown on the website
import {useState} from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
import AcademicYearSelector from "@/components/AcademicYearSelector";
import CourseSelector from "@/components/CourseSelector";
import MajorPlan from "@/components/MajorPlan"
import { useRemoteData } from "@/lib/use-remote-data";
import { STARTING_COLLEGE } from "@/lib/catalog-types";
import type { MajorAgreement } from "@/lib/planner";
//imports the different components as children


export default function Home() {
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [completedCourses, setCompletedCourses] = useState<string[]>([]); //starting value is an empty array of strings
  //creates useStates for the selected values

  const agreementUrl = selectedUniversity && selectedMajor && selectedAcademicYear
    ? `/api/agreement?${new URLSearchParams({
        university: selectedUniversity,
        major: selectedMajor,
        year: selectedAcademicYear
      })}`
    : null;
  const { data: selectedAgreement, isLoading: isPlanLoading, error: planError } =
    useRemoteData<MajorAgreement>(agreementUrl);

  function handleUniversityChange(value :string){
    setSelectedUniversity(value);
    setSelectedMajor("");
    setSelectedAcademicYear("");
  }

  function handleMajorChange(value: string) {
    setSelectedMajor(value);
    setSelectedAcademicYear("");
  }
  
  function handleCourseChange(courseCode :string, isChecked :boolean){
    if(isChecked){
      setCompletedCourses(previousCourses =>
        previousCourses.includes(courseCode) ? previousCourses : previousCourses.concat(courseCode)
      );
    }
    else{
      setCompletedCourses(previousCourses => previousCourses.filter(course => course !== courseCode));
    }
  }
//returns what is actually shown to the page in HTML
  return (
    <main>
      <h1>Transfer Planner</h1>
      <p>Plan your community college courses for transfer.</p>
      <p>Starting college: {STARTING_COLLEGE}</p>

      <UniversitySelector 
        selectedUniversity = {selectedUniversity}
        onUniversityChange = {handleUniversityChange}
      />
      <MajorSelector
        selectedUniversity = {selectedUniversity}
        selectedMajor = {selectedMajor}
        onMajorChange = {handleMajorChange}
      />
      <AcademicYearSelector
        selectedUniversity={selectedUniversity}
        selectedMajor={selectedMajor}
        selectedAcademicYear={selectedAcademicYear}
        onAcademicYearChange={setSelectedAcademicYear}
      />
      <CourseSelector
        completedCourses={completedCourses}
        onCourseChange={handleCourseChange}
        onClearCourses = {() => setCompletedCourses([])}
      />
      {isPlanLoading && <p role="status">Loading agreement...</p>}
      {planError && <p role="alert">{planError}</p>}
      {selectedAgreement && (
          <MajorPlan
          completedCourses={completedCourses}
          agreement={selectedAgreement}
          />
      )}
    </main>
  );
}
//<UniversitySelector and <MajorSelector actually passes in the props and gathers them into one object which is passed to the individual components
  