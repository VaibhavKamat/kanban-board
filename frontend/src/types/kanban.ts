export interface Column {
  id: string;
  key: string;
  name: string;
  order: number;
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string;
  dueDate: string | null;
  order: number;
}

export interface BoardSummary {
  id: string;
  type: "personal" | "project";
  name: string | null;
}
