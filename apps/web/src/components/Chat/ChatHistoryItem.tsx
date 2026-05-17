import { tokens } from "@/tokens";
import { cn, Label, ListBox } from "@heroui/react";

export default function ChatHistoryItem({
  id,
  textValue,
  createdAt,
  color,
  isSelected = false,
}: {
  id: string;
  textValue: string;
  createdAt: string;
  color: string;
  isSelected?: boolean;
}) {
  return (
    <ListBox.Item
      id={id}
      textValue={textValue}
      className="items-stretch py-0 my-0.5 w-[94%]"
      style={{
        backgroundColor: isSelected ? tokens.color.accent : "",
      }}
    >
      <div className="flex w-full items-stretch gap-2">
        <div className="w-1 py-px hidden">
          <div className={`w-full h-full rounded-full ${color}/50`}></div>
        </div>
        <Label
          className={cn("text-sm text-gray-500 flex-1 self-center truncate", {
            "text-white": isSelected,
          })}
        >
          {textValue}
        </Label>
        <span className="text-sm leading-5 text-gray-400 hidden">
          {createdAt}
        </span>
      </div>
    </ListBox.Item>
  );
}
