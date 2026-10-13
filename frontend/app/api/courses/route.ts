import { getCourses } from "@/lib/catalog";
import { STARTING_COLLEGE } from "@/lib/catalog-types";

export async function GET() {
  try {
    return Response.json(await getCourses(STARTING_COLLEGE));
  } catch (error) {
    console.error("Failed to load courses:", error);
    return Response.json({ error: "Unable to load courses" }, { status: 500 });
  }
}
