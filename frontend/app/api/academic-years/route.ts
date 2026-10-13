import { getAcademicYears } from "@/lib/catalog";
import { STARTING_COLLEGE } from "@/lib/catalog-types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const university = params.get("university");
  const major = params.get("major");
  if (!university?.trim() || !major?.trim()) {
    return Response.json({ error: "University and major are required" }, { status: 400 });
  }
  try {
    return Response.json(await getAcademicYears(university, major, STARTING_COLLEGE));
  } catch (error) {
    console.error("Failed to load academic years:", error);
    return Response.json({ error: "Unable to load academic years" }, { status: 500 });
  }
}
