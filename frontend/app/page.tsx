"use client";

//cd frontend
//npm run dev


//the page that represents what is shown on the website
import {useState} from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
import CourseSelector from "@/components/CourseSelector";
import MajorPlan from "@/components/MajorPlan"
import {berkeleyCsAgreement} from "@/data/berkeleyCs";
//imports the different components as children



export default function Home() {
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [completedCourses, setCompletedCourses] = useState<string[]>([]); //starting value is an empty array of strings
  //creates useStates for the selected values

  function handleUniversityChange(value :string){
    setSelectedUniversity(value);
    setSelectedMajor("");
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
        onMajorChange = {setSelectedMajor}
      />
      <CourseSelector
        completedCourses={completedCourses}
        onCourseChange={handleCourseChange}
      />
      {selectedUniversity === "University of California, Berkeley" &&
        selectedMajor === "Computer Science, B.A." && (
          <MajorPlan
          completedCourses={completedCourses}
          agreement={berkeleyCsAgreement}
          />
      )}
    </main>
  );
}
//<UniversitySelector and <MajorSelector actually passes in the props and gathers them into one object which is passed to the individual components
