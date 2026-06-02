export type DeadlineState = "overdue" | "soon" | "normal" | "none";

export type FolderPlan = {
  safeRoot: string;
  relativeRoot: string;
  folders: Array<{
    absolutePath: string;
    relativePath: string;
  }>;
  summaryFile: string;
  summaryContent: string;
  files: Array<{
    fileType: "order-summary" | "retouch-list" | "print-list";
    filename: string;
    absolutePath: string;
    relativePath: string;
    content: string;
  }>;
  targetPaths: string[];
  warnings: string[];
};
