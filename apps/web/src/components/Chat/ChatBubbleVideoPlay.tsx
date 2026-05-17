import { Card } from "@heroui/react";
import { createElement, useEffect } from "react";

const SUTRO_PLAYER_SCRIPT_ID = "sutro-player-style-script";
const SUTRO_PLAYER_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/npm/player.style/sutro/+esm";
const SUTRO_VIDEO_SRC =
  "https://stream.mux.com/fXNzVtmtWuyz00xnSrJg4OJH6PyNo6D02UzmgeKGkP5YQ/low.mp4";

export default function ChatBubbleVideoPlay() {
  useEffect(() => {
    if (document.getElementById(SUTRO_PLAYER_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = SUTRO_PLAYER_SCRIPT_ID;
    script.type = "module";
    script.src = SUTRO_PLAYER_SCRIPT_SRC;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <Card
      id="chat-bubble-video-play"
      className="relative aspect-video w-full items-stretch overflow-hidden border border-solid border-[#e9e9e9] p-0 shadow-none"
    >
      {createElement(
        "media-theme-sutro",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "block",
          },
        },
        createElement("video", {
          slot: "media",
          src: SUTRO_VIDEO_SRC,
          playsInline: true,
          crossOrigin: "anonymous",
        }),
      )}
    </Card>
  );
}
