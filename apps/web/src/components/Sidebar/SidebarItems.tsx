import { cn, Label, ListBox } from "@heroui/react";
import {
  MessageCircleMore,
  Podcast,
  PocketKnife,
  Telescope,
} from "lucide-react";
import { tokens } from "@/tokens";
function SidebarItem({
  id,
  textValue,
  label,
  icon,
  badge,
  active = false,
}: {
  id: string;
  textValue: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  active?: boolean;
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
        {badge && (
          <>
            <div className="flex-1 h-1"></div>
            <Label
              className={cn(
                "rounded-full w-5 h-5 text-[12px]! flex justify-center items-center",
                { "text-white": active, "font-semibold": active },
              )}
            >
              {badge}
            </Label>
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
              color={tokens.color.white}
              className="shrink-0"
            />
          }
          label="Chat"
          active
          badge="12"
        />
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
