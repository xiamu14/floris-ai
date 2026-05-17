import { tokens } from "@/tokens";
import { Button } from "@heroui/react";
import {
  Archive,
  ArrowUp,
  Circle,
  ListChevronsDownUp,
  Plus,
} from "lucide-react";

export default function ChatInput() {
  return (
    <div className="flex w-full justify-start">
      <div
        id="chat-input-container "
        className="w-[80%] flex flex-col gap-2 h-30"
      >
        <div
          id="chat-input"
          className="relative flex h-25 w-full flex-col rounded-3xl border border-solid border-[#e9e9e9] px-2 py-2  transition-shadow md:h-30 focus-within:border-transparent focus-within:bg-[--color-field-focus] focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-0"
        >
          <textarea
            aria-label="AI chat tips"
            className="flex-1 w-full resize-none border-0 bg-transparent p-0 text-base outline-none [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
            placeholder="What can I help you with?"
          />
          <div className="w-full h-8 cursor-pointer justify-between">
            <div className="flex justify-start items-center">
              <Button variant="ghost" className={"rounded-2xl w-8 h-8"}>
                <Plus color={tokens.color.black200} size={22} />
              </Button>
            </div>
            <Button className="absolute right-2 bottom-2 w-8 h-8 rounded-full">
              <ArrowUp color={tokens.color.white} size={20} />
            </Button>
          </div>
        </div>
        <div className="flex justify-start items-center w-full gap-1">
          <Button variant="ghost" className={"rounded-full w-10 h-6"}>
            <ListChevronsDownUp size={20} color={tokens.color.black200} />
          </Button>
          <Button variant="ghost" className={"rounded-full w-10 h-6"}>
            <Archive size={20} color={tokens.color.black200} />
          </Button>
          <div className="flex-1 h-1"></div>
          <div
            className={
              "bg-transparent w-10 h-6 mr-1 flex justify-center items-center"
            }
          >
            {/*TODO:show memory space reset*/}
            <Circle size={18} color={tokens.color.accent} />
          </div>
        </div>
      </div>
    </div>
  );
}
