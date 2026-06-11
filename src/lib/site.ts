export const siteContact = {
  xHandle: "AIContestNavi",
  xProfileUrl: "https://x.com/AIContestNavi",
  xDmUrl: "",
} as const;

export const xProfileUrl = siteContact.xProfileUrl;
export const xContactUrl = siteContact.xDmUrl || siteContact.xProfileUrl;
