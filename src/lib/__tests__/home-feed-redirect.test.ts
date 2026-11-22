import { describe, expect, it } from "vitest";
import {
  editorialHomeHref,
  loggedInFeedRedirect,
  wantsEditorialHome,
} from "../home-feed-redirect";

const signedIn = {
  isAuthenticated: true,
  authResolved: true,
};

describe("loggedInFeedRedirect", () => {
  it("sends a signed-in visitor from / and /vi to the feed", () => {
    expect(loggedInFeedRedirect({ pathname: "/", search: "", ...signedIn })).toBe("/feed");
    expect(loggedInFeedRedirect({ pathname: "/vi", search: "", ...signedIn })).toBe("/vi/feed");
    expect(loggedInFeedRedirect({ pathname: "/vi/", search: "?", ...signedIn })).toBe("/vi/feed");
  });

  it("leaves logged-out visitors, unresolved sessions, and other pages on the homepage", () => {
    expect(loggedInFeedRedirect({
      pathname: "/",
      search: "",
      isAuthenticated: false,
      authResolved: true,
    })).toBeNull();
    expect(loggedInFeedRedirect({
      pathname: "/vi",
      search: "",
      isAuthenticated: true,
      authResolved: false,
    })).toBeNull();
    expect(loggedInFeedRedirect({
      pathname: "/tournaments",
      search: "",
      ...signedIn,
    })).toBeNull();
  });

  it("stays on the editorial homepage when the Home link set home=1", () => {
    expect(wantsEditorialHome("?home=1")).toBe(true);
    expect(wantsEditorialHome("?utm=newsletter&home=1")).toBe(true);
    expect(wantsEditorialHome("?home=0")).toBe(false);
    expect(loggedInFeedRedirect({ pathname: "/", search: "?home=1", ...signedIn })).toBeNull();
    expect(loggedInFeedRedirect({ pathname: "/vi", search: "?tab=1&home=1", ...signedIn })).toBeNull();
  });
});

describe("editorialHomeHref", () => {
  it("points Home back at the homepage in the page language without looping", () => {
    expect(editorialHomeHref("en")).toBe("/?home=1");
    expect(editorialHomeHref("vi")).toBe("/vi?home=1");
    expect(loggedInFeedRedirect({
      pathname: "/",
      search: editorialHomeHref("en").slice(1),
      ...signedIn,
    })).toBeNull();
    expect(loggedInFeedRedirect({
      pathname: "/vi",
      search: "?home=1",
      ...signedIn,
    })).toBeNull();
  });
});
