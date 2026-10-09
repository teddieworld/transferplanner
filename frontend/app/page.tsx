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
import { agreements } from "./agreements";
//imports the different components as children


export default function Home() {
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [completedCourses, setCompletedCourses] = useState<string[]>([]); //starting value is an empty array of strings
  //creates useStates for the selected values

  const selectedAgreement = agreements.find(agreement =>
    agreement.university === selectedUniversity &&
    agreement.major === selectedMajor &&
    agreement.academicYear === selectedAcademicYear
  );

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
      setCompletedCourses(previousCourses => previousCourses.concat(courseCode));
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
