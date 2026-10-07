"use client";
//cd frontend
//npm run dev

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
            <h2>Select a University</h2>
            <select 
            value = {selectedUniversity}
            onChange={(event) => onUniversityChange(event.target.value)}
            >
                <option value="">
                    Select a university
                </option>
                <option value = "University of California, Berkeley">
                    UC Berkeley
                </option>
                <option value = "University of California, Los Angeles">
                    UCLA
                </option>
            </select>
        </div>
    );
}
