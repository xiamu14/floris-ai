import { Avatar, Button, Card } from "@heroui/react";
import { Pill } from "lucide-react";

export default function ChatBubbleRight({
  text,
  time,
}: {
  text: string;
  time: string;
}) {
  return (
    <div className="chat-bubble chat-bubble__right w-full flex flex-row-reverse justify-start items-start gap-3">
      <Avatar size="sm">
        <Avatar.Image
          alt="John Doe"
          src="https://img.heroui.chat/image/avatar?w=400&h=400&u=3"
        />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar>
      <div className="chat-message w-[calc(100%-88px)] flex flex-col gap-2 justify-end items-end">
        <Card className="max-w-full items-stretch md:flex-row border border-solid border-[#e9e9e9] shadow-none">
          <div className="flex flex-1 flex-col gap-3">
            <Card.Header className="gap-1">
              <Card.Description className="text-gray-800">
                {text}
              </Card.Description>
            </Card.Header>
          </div>
        </Card>
        <div className="w-full gap-1 flex flex-row-reverse justify-start items-center">
          <p className="text-gray-300 text-sm">{time}</p>
          {/*TODO:just for disconnet or stop to resend again*/}
          <Button variant="ghost" className={"w-8 h-8 rounded-lg hidden"}>
            <Pill size={22} color="gray" />
          </Button>
        </div>
      </div>
    </div>
  );
}
