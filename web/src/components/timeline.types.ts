export type TimelineEventState = "running" | "success" | "error";

export interface TimelineEvent {
  id: string;
  timestamp: number;
  title: string;
  state: TimelineEventState;
  data?: unknown;
}