import { tokens } from "@/tokens";
import { Avatar, Button } from "@heroui/react";
import { Copy, Paperclip } from "lucide-react";

export default function ChatBubbleLeft({
  time,
  children,
  copyable = false,
}: React.PropsWithChildren<{ time: string; copyable?: boolean }>) {
  return (
    <div className="chat-bubble chat-bubble__left w-full flex flex-row justify-start items-start gap-3">
      <Avatar size="sm">
        <Avatar.Image
          alt="Blue"
          src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
        />
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <div className="chat-message flex flex-col gap-2 w-[calc(100%-88px)]">
        {children}
        <div className="w-full gap-1 flex flex-start items-center">
          <p className="text-gray-300 text-sm">{time}</p>
          {/*TODO: paperclip Answer*/}
          <Button variant="ghost" className={"w-8 h-6 rounded-full"}>
            <Paperclip size={22} color={tokens.color.gray300} />
          </Button>
          {copyable && (
            <Button variant="ghost" className={"w-8 h-6 rounded-full"}>
              <Copy size={22} color={tokens.color.gray300} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
