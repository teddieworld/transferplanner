import { getUniversities } from "@/lib/catalog";
//handles requests from our sql database

export async function GET() {
  try {
    return Response.json(await getUniversities());
  } catch (error) {
    console.error("Failed to load universities:", error);

    return Response.json(
      { error: "Unable to load universities" },
      { status: 500 }
    );
  }
}
