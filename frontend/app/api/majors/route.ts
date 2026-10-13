import { getMajors } from "@/lib/catalog";

export async function GET(request: Request) {
  const university = new URL(request.url).searchParams.get("university");
  if (!university?.trim()) {
    return Response.json({ error: "University is required" }, { status: 400 });
  }
  try {
    return Response.json(await getMajors(university));
  } catch (error) {
    console.error("Failed to load majors:", error);
    return Response.json({ error: "Unable to load majors" }, { status: 500 });
  }
}
