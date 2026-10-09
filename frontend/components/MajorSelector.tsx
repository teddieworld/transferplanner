"use client";

import { agreements } from "@/app/agreements";

type MajorSelectorProps = {
    selectedUniversity: string;
    selectedMajor: string;
    onMajorChange: (value: string) => void;
};
//tells what inputs are expected and their type

//declares the actual component
export default function MajorSelector({
    selectedUniversity,
    selectedMajor,
    onMajorChange
}: MajorSelectorProps)
//receives the props object, destructures its properties and checks their types using majorselectorprops
{
    const availableMajors = [
        ...new Set(
            agreements
                .filter(agreement => agreement.university === selectedUniversity)
                .map(agreement => agreement.major)
        )
    ];

    //value = ___ sets the value that is actually shown in React/UI
    //onChange sends the value back to the react state so it is changed in the code
    return(
        <div>
            <label htmlFor="major">
                Select a major
            </label>
            <select 
            value = {selectedMajor}
            onChange={(event) => onMajorChange(event.target.value)}
            disabled={availableMajors.length===0}
            id="major"
            >
                <option value="">
                    Select a major
                </option>
                { availableMajors.map(major => (
                <option 
                key={major} 
                value={major}
                >
                    {major}
                </option>
                ))}
            </select>
            {
                selectedUniversity !== "" && availableMajors.length === 0 && 
                <p>
                    No majors have been added for this university yet.
                </p>
            }
        </div>
    );
}
