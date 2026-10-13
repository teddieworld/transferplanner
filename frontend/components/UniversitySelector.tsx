"use client";

import { useRemoteData } from "@/lib/use-remote-data";
import type { University } from "@/lib/catalog-types";

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
    const { data, isLoading, error } = useRemoteData<University[]>("/api/universities");
    const universities = data ?? [];

    //value = ___ sets the value that is actually shown in React/UI
    //onChange sends the value back to the react state so it is changed in the code
    return(
        <div>
            <label htmlFor="university">
                Select a University
            </label>
            <select 
            value = {selectedUniversity}
            onChange={(event) => onUniversityChange(event.target.value)}
            id="university"
            disabled = {isLoading || error !== null}
            >
                <option value="">
                    {isLoading ? "Loading universities..." : "Select a University"}
                </option>
            {universities.map(university => (
            <option key={university.id} value={university.name}>
                {university.name}
            </option>
            ))}
            </select>
            {error && <p role="alert">{error}</p>}
            {!isLoading && !error && universities.length === 0 && (
                <p>No universities have been added yet.</p>
            )}
        </div>
    );
}
