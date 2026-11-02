export const voices = [
  { name: "Algieba", gender: "Male" },
  { name: "Orus", gender: "Male" },
  { name: "Umbriel", gender: "Male" },
  { name: "Callirrhoe", gender: "Female" },
  { name: "Despina", gender: "Female" },
] as const;
export type Voice = (typeof voices)[number]["name"];
export type Segment = {
  id: string;
  start: number;
  end: number;
  speaker: string;
  original: string;
  translation: string;
  voice: Voice;
  status: "Draft" | "Reviewed";
};
export type Project = { id: string; name: string; segments: Segment[] };
