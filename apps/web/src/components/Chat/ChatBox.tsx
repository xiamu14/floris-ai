import ChatBubbleExample from "./ChatBubbleExample";
import ChatBubbleLeft from "./ChatBubbleLeft";
import ChatBubbleMD from "./ChatBubbleMD";
import ChatBubbleMusicPlay from "./ChatBubbleMusicPlay";
import ChatBubbleRight from "./ChatBubbleRight";
import ChatBubbleVideoPlay from "./ChatBubbleVideoPlay";
import ChatInput from "./ChatInput";

export default function ChatBox() {
  return (
    <div
      id="content-wrapper"
      className="flex h-full min-h-0 flex-1 flex-col items-center w-full px-6 max-w-150 md:max-w-250 justify-center py-10 m-auto gap-4"
    >
      <div
        id="chat-messages"
        className="w-full min-h-0 flex-1 flex flex-col gap-5"
      >
        <div className="w-full h-full flex justify-between">
          <div className="w-full shrink-0 h-full flex flex-col gap-4 overflow-y-auto scrollbar-hide">
            <ChatBubbleRight
              text="Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam dolor sed amet faucibus etiam."
              time="19:01"
            />
            <ChatBubbleLeft time="19:12">
              <ChatBubbleExample />
            </ChatBubbleLeft>
            <ChatBubbleRight
              text="Find a soothing piece of music."
              time="20:01"
            />
            <ChatBubbleLeft time="20:10">
              <ChatBubbleMusicPlay />
            </ChatBubbleLeft>
            <ChatBubbleRight text="I want watch a movie." time="21:01" />
            <ChatBubbleLeft time="21:10">
              <ChatBubbleVideoPlay />
            </ChatBubbleLeft>
            <ChatBubbleRight text="I want watch a movie." time="06:31" />
            <ChatBubbleLeft time="06:35" copyable>
              <ChatBubbleMD
                markdown={`# Title

## H2

This is a **markdown** message. I'm your friend to help your life.

- item 1
- item 2

\`inline code\``}
              />
            </ChatBubbleLeft>
          </div>
        </div>
      </div>
      <ChatInput />
    </div>
  );
}
