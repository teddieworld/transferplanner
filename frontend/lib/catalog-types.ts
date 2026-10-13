export const STARTING_COLLEGE = "Mt. San Antonio College";

export type University = { id: number; name: string };
export type Major = { id: number; name: string };

export type CourseCatalogEntry = {
  id: number;
  code: string;
  title: string;
  minUnits: number;
  maxUnits: number;
  ucTransferable: boolean;
  csuTransferable: boolean;
  description: string | null;
  requirements: {
    type: string;
    text: string;
    referencedCourses: string[];
  }[];
};
