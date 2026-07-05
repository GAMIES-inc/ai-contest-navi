export const siteContact = {
  xHandle: "yuru_contest_navi",
  xProfileUrl: "https://x.com/yuru_contest_navi",
  xDmUrl: "",
} as const;

export const xProfileUrl = siteContact.xProfileUrl;
export const xContactUrl = siteContact.xDmUrl || siteContact.xProfileUrl;
