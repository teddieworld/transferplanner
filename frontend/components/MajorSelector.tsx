"use client";
//cd frontend
//npm run dev

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
    //value = ___ sets the value that is actually shown in React/UI
    //onChange sends the value back to the react state so it is changed in the code
    return(
        <div>
            <h2>Select a Major</h2>
            <select 
            value = {selectedMajor}
            onChange={(event) => onMajorChange(event.target.value)}
            disabled = {selectedUniversity === ""}
            >
                <option value="">
                    Select a major
                </option>
                {selectedUniversity === "University of California, Berkeley" && (
                    <option value = "Computer Science, B.A.">
                        Computer Science
                    </option>
                )}
            </select>

        </div>
    );
}
