"use client";

import { universities } from "@/app/agreements";

type UniversitySelectorProps = {
    selectedUniversity: string;
    onUniversityChange: (value: string) => void;
};
//tells what inputs are expected and their type

//declares the actual component
export default function UniversitySelector({
    selectedUniversity,
    onUniversityChange
}: UniversitySelectorProps)
//receives the props object, destructures its properties and checks their types using universityselectorprops
{
    //value = ___ sets the value that is actually shown in React/UI
    //onChange sends the value back to the react state so it is changed in the code
    return(
        <div>
            <label htmlFor="university">
                Select a university
            </label>
            <select 
            value = {selectedUniversity}
            onChange={(event) => onUniversityChange(event.target.value)}
            id="university"
            >
                <option value="">
                    Select a University
                </option>
            {universities.map(university => (
            <option key={university} value={university}>
                {university}
            </option>
            ))}
            </select>
        </div>
    );
}
