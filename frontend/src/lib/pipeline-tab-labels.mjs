// What the Applications page calls each tracker stage. The URL keeps the
// canonical codes (?tab=EVALUATED); people see plain words.

/** @type {Record<string, string>} */
export const TAB_LABEL = {
  INBOX: "Inbox",
  ALL: "All",
  EVALUATED: "To decide",
  APPLIED: "Applied",
  RESPONDED: "Heard back",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interviewing",
  OFFER: "Offers",
  HIRED: "Hired",
  REJECTED: "Rejected",
  DISCARDED: "Discarded",
  SKIP: "Skipped",
};

/** @param {string} tab */
export function tabLabel(tab) {
  return TAB_LABEL[tab] ?? tab.charAt(0) + tab.slice(1).toLowerCase();
}
