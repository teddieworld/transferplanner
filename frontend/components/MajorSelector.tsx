"use client";

import { useRemoteData } from "@/lib/use-remote-data";
import type { Major } from "@/lib/catalog-types";

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
    const url = selectedUniversity
        ? `/api/majors?${new URLSearchParams({ university: selectedUniversity })}`
        : null;
    const { data, isLoading, error } = useRemoteData<Major[]>(url);
    const availableMajors = data ?? [];

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
            disabled={isLoading || error !== null || availableMajors.length === 0}
            id="major"
            >
                <option value="">
                    {isLoading ? "Loading majors..." : "Select a major"}
                </option>
                { availableMajors.map(major => (
                <option 
                key={major.id}
                value={major.name}
                >
                    {major.name}
                </option>
                ))}
            </select>
            {
                selectedUniversity !== "" && !isLoading && !error && availableMajors.length === 0 &&
                <p>
                    No majors have been added for this university yet.
                </p>
            }
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
