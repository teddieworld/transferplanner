"use client";

//cd frontend
//npm run dev


//the page that represents what is shown on the website
import {useState} from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
//imports the different components as children

const courses = [
  { 
    code: "MATH 180", 
    title: "Calculus and Analytic Geometry I"
  },
  {
    code: "MATH 181",
    title: "Calculus and Analytic Geometry II"
  }
];

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
      setCompletedCourses(completedCourses.concat(courseCode));
    }
    else{
      setCompletedCourses(completedCourses.filter(course => course !== courseCode));
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
      {
        courses.map(course => 
        <label key={course.code}
        className="block">
          <input type="checkbox" 
          checked={completedCourses.includes(course.code)}
          onChange={event => handleCourseChange(course.code, event.target.checked)}
          />
          {course.code} - {course.title}
      </label>
        )
      }
      
      <p>{completedCourses.length === 0 ? "No completed courses selected": 
          completedCourses.join(", ")
      }</p>

    </main>
  );
}
//<UniversitySelector and <MajorSelector actually passes in the props and gathers them into one object which is passed to the individual components
