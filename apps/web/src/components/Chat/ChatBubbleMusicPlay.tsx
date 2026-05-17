import { tokens } from "@/tokens";
import { Button, Card } from "@heroui/react";
import { ChevronFirst, ChevronLast, Play } from "lucide-react";

export default function ChatBubbleMusicPlay() {
  return (
    <Card className="relative py-5 h-64 w-60 items-stretch overflow-hidden md:h-70 md:w-80">
      <img
        id="music-player-cover"
        alt="NEO Home Robot"
        aria-hidden="true"
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?q=80&w=2226&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1 bg-[linear-gradient(180deg,rgba(30,30,30,0)_0%,rgba(30,30,30,0.08)_22%,rgba(30,30,30,0.22)_42%,rgba(30,30,30,0.5)_62%,rgba(30,30,30,0.85)_80%,rgba(30,30,30,1)_100%)]"
      />

      {/* Header */}
      <Card.Header className="z-10 text-white">
        <Card.Title className="text-xs font-semibold tracking-wide text-white">
          NEO
        </Card.Title>
        <Card.Description className="text-sm leading-5 font-medium text-white/80">
          Musican
        </Card.Description>
      </Card.Header>
      <Card.Content className="px-5 py-5 pt-[40%] flex flex-col justify-start items-center gap-3 z-10">
        <h3 className="text-white font-semibold text-2xl">漫步神秘园</h3>
        <p className="text-white/75">作者:xxx</p>
      </Card.Content>
      {/* Footer */}
      <Card.Footer className="z-10 mt-auto w-full flex items-center justify-center gap-5">
        <Button
          id="music-play-button"
          className="bg-white/0 rounded-full w-10 h-10"
          size="md"
          variant="tertiary"
        >
          <ChevronFirst size={26} color={tokens.color.white} />
        </Button>
        <Button
          id="music-play-button"
          className="bg-white/60 rounded-full w-10 h-10"
          size="md"
          variant="tertiary"
        >
          <Play size={24} color={tokens.color.accent} />
        </Button>
        <Button
          id="music-play-button"
          className="bg-white/0 rounded-full w-10 h-10"
          size="md"
          variant="tertiary"
        >
          <ChevronLast size={26} color={tokens.color.white} />
        </Button>
      </Card.Footer>
    </Card>
  );
}
