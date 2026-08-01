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
  order: number;
}
