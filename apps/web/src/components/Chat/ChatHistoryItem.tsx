import { Label, ListBox } from "@heroui/react";

export default function ChatHistoryItem({
  id,
  textValue,
  createdAt,
  color,
}: {
  id: string;
  textValue: string;
  createdAt: string;
  color: string;
}) {
  return (
    <ListBox.Item id={id} textValue={textValue} className="items-stretch py-0">
      <div className="flex w-full items-stretch gap-2 py-2">
        <div className="w-1 py-px hidden">
          <div className={`w-full h-full rounded-full ${color}/50`}></div>
        </div>
        <Label className="text-md flex-1 self-center">{textValue}</Label>
        <span className="text-sm leading-5 text-gray-400">{createdAt}</span>
      </div>
    </ListBox.Item>
  );
}
