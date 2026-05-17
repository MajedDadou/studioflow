export type DeadlineState = "overdue" | "soon" | "normal" | "none";

export type FolderPlan = {
  safeRoot: string;
  relativeRoot: string;
  folders: string[];
  summaryFile: string;
  summaryContent: string;
  warnings: string[];
};
