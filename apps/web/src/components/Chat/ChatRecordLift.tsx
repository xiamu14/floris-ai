import { cn } from "@heroui/styles";

function RecordItem({ text, size }: { text: string; size: "sm" | "md" }) {
  return (
    <div className="group/record flex w-full items-center justify-start gap-2 cursor-pointer">
      <div
        className={cn(
          "h-1 origin-left rounded-full bg-gray-200 transition-transform duration-200 ease-out group-hover/record:scale-120",
          size === "sm" ? "w-4" : "w-5",
        )}
      ></div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm w-full min-w-0 leading-1.1 overflow-hidden truncate whitespace-nowrap text-gray-400 opacity-0 transition-opacity duration-200 group-hover/record:opacity-100",
            { "text-accent font-semibold": size === "md" },
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

export default function ChatRecordLift() {
  return (
    <div className="w-full h-full bg-white flex-col flex justify-center items-start gap-0 shrink-0">
      {[
        "Lorem ipsum dolor sit amet consectetur.",
        "Find a soothing piece of music.",
        "I want watch a movie.",
        "I want watch a movie.",
      ].map((text, index) => (
        <RecordItem size={index == 0 ? "md" : "sm"} key={index} text={text} />
      ))}
    </div>
  );
}
