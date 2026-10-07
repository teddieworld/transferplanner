"use client";
//the page that represents what is shown on the website
import {useState} from "react";
import UniversitySelector from "@/components/UniversitySelector";
import MajorSelector from "@/components/MajorSelector";
//imports the different components as children

export default function Home() {
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  //creates useStates for the selected values

  function handleUniversityChange(value :string){
    setSelectedUniversity(value);
    setSelectedMajor("");
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
    </main>
  );
}
//<UniversitySelector and <MajorSelector actually passes in the props and gathers them into one object which is passed to the individual components
