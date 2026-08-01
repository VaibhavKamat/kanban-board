import type { Card, Column } from "@/types/kanban";

export const mockColumns: Column[] = [
  { id: "col-1", key: "backlog", name: "Backlog", order: 0 },
  { id: "col-2", key: "todo", name: "To Do", order: 1 },
  { id: "col-3", key: "in_progress", name: "In Progress", order: 2 },
  { id: "col-4", key: "review", name: "Review", order: 3 },
  { id: "col-5", key: "done", name: "Done", order: 4 },
];

export const mockCards: Card[] = [
  {
    id: "card-1",
    columnId: "col-1",
    title: "Set up analytics",
    description: "Add basic usage tracking to the dashboard.",
    order: 0,
  },
  {
    id: "card-2",
    columnId: "col-1",
    title: "Research competitors",
    description: "Compare feature sets of similar Kanban tools.",
    order: 1,
  },
  {
    id: "card-3",
    columnId: "col-2",
    title: "Design login screen",
    description: "Mock up the sign-in form with the brand colors.",
    order: 0,
  },
  {
    id: "card-4",
    columnId: "col-3",
    title: "Build drag-and-drop",
    description: "Cards should move between columns smoothly.",
    order: 0,
  },
  {
    id: "card-5",
    columnId: "col-4",
    title: "Review API contract",
    description: "Confirm the board response shape with the team.",
    order: 0,
  },
  {
    id: "card-6",
    columnId: "col-5",
    title: "Project kickoff",
    description: "Initial planning meeting completed.",
    order: 0,
  },
];
