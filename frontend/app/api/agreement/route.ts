import { getAgreement } from "@/lib/catalog";
import { STARTING_COLLEGE } from "@/lib/catalog-types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const university = params.get("university");
  const major = params.get("major");
  const year = params.get("year");
  if (!university?.trim() || !major?.trim() || !year?.trim()) {
    return Response.json({ error: "University, major, and year are required" }, { status: 400 });
  }
  try {
    const agreement = await getAgreement(university, major, year, STARTING_COLLEGE);
    if (!agreement) {
      return Response.json({ error: "Agreement not found" }, { status: 404 });
    }
    return Response.json(agreement);
  } catch (error) {
    console.error("Failed to load agreement:", error);
    return Response.json({ error: "Unable to load agreement" }, { status: 500 });
  }
}
