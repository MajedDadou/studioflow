export const retouchStatuses = [
  "Not started",
  "Sent to retoucher",
  "In progress",
  "Needs changes",
  "Done",
  "Approved",
  "Cancelled"
];

export const activeRetouchStatuses = ["Not started", "Sent to retoucher", "In progress", "Needs changes"];
export const finishedRetouchStatuses = ["Done", "Approved"];

export function orderItemStatusForRetouchStatus(status: string) {
  if (status === "Done" || status === "Approved") return "Ready";
  if (status === "Sent to retoucher" || status === "In progress" || status === "Needs changes") return "In production";
  if (status === "Cancelled") return "New";
  return "New";
}
