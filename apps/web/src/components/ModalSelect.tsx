import { tokens } from "@/tokens";
import { ListBox, Select } from "@heroui/react";
import { ChevronsUpDown } from "lucide-react";

export default function ModalSelect() {
  return (
    <Select className="w-auto rounded-full" placeholder="Mimo Pro 2 中">
      <Select.Trigger
        className={"rounded-full shadow-none py-1 px-2 min-h-auto items-center"}
      >
        <Select.Value />
        <div className="w-4 h-4 ml-1">
          <ChevronsUpDown size={16} color={tokens.color.gray300} />
        </div>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            5.3-Codex 中
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            5.5-Codex 高
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
