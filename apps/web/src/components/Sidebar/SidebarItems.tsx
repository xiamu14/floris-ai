import { cn, Label, ListBox } from "@heroui/react";
import {
  MessageCircleMore,
  Podcast,
  PocketKnife,
  Telescope,
  FolderClosed,
  ChevronUp,
  ChevronDown,
  Plus,
} from "lucide-react";
import { tokens } from "@/tokens";
import ChatHistoryItem from "../Chat/ChatHistoryItem";
function SidebarItem({
  id,
  textValue,
  label,
  icon,
  active = false,
  showPlusIcon = false,
  isFolded = false,
}: {
  id: string;
  textValue: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  active?: boolean;
  showPlusIcon?: boolean;
  isFolded?: boolean;
}) {
  return (
    <ListBox.Item
      id={id}
      textValue={textValue}
      className={cn("px-2 w-full", { "bg-accent": active })}
    >
      <div className="flex justify-start items-center gap-2 w-full">
        {icon}
        <Label
          className={cn("", { "text-white": active, "font-semibold": active })}
        >
          {label}
        </Label>
        {showPlusIcon && (
          <>
            <div className="flex-1 h-1"></div>
            <Plus
              size={16}
              color={tokens.color.black200}
              className="shrink-0"
            />
          </>
        )}
      </div>
    </ListBox.Item>
  );
}
export default function SidebarItems() {
  return (
    <div className="w-full sidebar-playground playground-items px-2">
      <ListBox
        aria-label="playgroundItems"
        className="w-[98%] gap-3"
        selectionMode="single"
      >
        <SidebarItem
          id="1"
          textValue="Chat"
          icon={
            <MessageCircleMore
              size={16}
              color={tokens.color.black200}
              className="shrink-0"
            />
          }
          showPlusIcon
          isFolded={false}
          label="Chat"
          badge="3"
        />
        <ListBox.Section>
          <ChatHistoryItem
            id="1-1"
            textValue="You known AI Agent?"
            color="bg-amber-400"
            createdAt="3天"
            isSelected
          />
          <ChatHistoryItem
            id="1-2"
            textValue="Are you an AI agent?"
            color="bg-blue-400"
            createdAt="1周"
          />
          <ChatHistoryItem
            id="1-3"
            textValue="Give me a soft music?"
            color="bg-green-400"
            createdAt="1天"
          />
        </ListBox.Section>

        <SidebarItem
          id="2"
          textValue="Subsciption"
          icon={
            <Podcast
              size={16}
              color={tokens.color.black200}
              className="shrink-0"
            />
          }
          label="Subsciption"
        />
        <SidebarItem
          id="3"
          textValue="Service"
          icon={
            <PocketKnife
              size={16}
              color={tokens.color.black200}
              className="shrink-0"
            />
          }
          label="Service"
        />
        <SidebarItem
          id="4"
          textValue="Vision"
          icon={<Telescope size={16} color={tokens.color.black200} />}
          label="Vision"
        />
      </ListBox>
    </div>
  );
}
