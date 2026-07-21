/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { VideoThumbnail } from "../VideoThumbnail";

afterEach(cleanup);

describe("VideoThumbnail", () => {
  it("does not fetch video metadata when a listing disables the video fallback", () => {
    const { container } = render(
      <VideoThumbnail
        title="Large MOV"
        storagePath="org/example/large.mov"
        showIconFallback={false}
        allowVideoFallback={false}
      />,
    );

    expect(container.querySelector("video")).toBeNull();
  });

  it("preserves the first-frame fallback on detail and creator surfaces", () => {
    const { container } = render(
      <VideoThumbnail title="Uploaded clip" storagePath="org/example/clip.mp4" />,
    );

    expect(container.querySelector("video")).not.toBeNull();
  });
});
