import SidebarHeader from "@/components/Sidebar/SidebarHeader";
import { createFileRoute } from "@tanstack/react-router";

import SidebarItems from "@/components/Sidebar/SidebarItems";
import ChatInput from "@/components/Chat/ChatInput";

import ChatBubbleRight from "@/components/Chat/ChatBubbleRight";
import ChatBubbleLeft from "@/components/Chat/ChatBubbleLeft";
import ChatBubbleExample from "@/components/Chat/ChatBubbleExample";
import ChatBubbleMusicPlay from "@/components/Chat/ChatBubbleMusicPlay";
import ChatBubbleVideoPlay from "@/components/Chat/ChatBubbleVideoPlay";
import ChatBubbleMD from "@/components/Chat/ChatBubbleMD";

import ChatHistoryItem from "@/components/Chat/ChatHistoryItem";
import { Avatar, Label, ListBox, SearchField } from "@heroui/react";
import ChatRecordLift from "@/components/Chat/ChatRecordLift";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <main className="page-wrap p-0 m-0 overflow-hidden flex h-dvh bg-white">
      <div id="sidebar-wrapper" className="w-50 md:w-60">
        <div className="sidebar-content h-full w-full px-5 py-5 pb-10 flex flex-col items-center">
          <SidebarHeader />
          <div className="w-full h-4"></div>
          <SidebarItems />
          <div className="flex-1 w-full"></div>
          <div className="w-full flex justify-start items-center gap-3 px-4 cursor-pointer">
            <Avatar size="sm">
              <Avatar.Image
                alt="John Doe"
                src="https://img.heroui.chat/image/avatar?w=400&h=400&u=3"
              />
              <Avatar.Fallback>JD</Avatar.Fallback>
            </Avatar>
            <Label>JD</Label>
          </div>
        </div>
      </div>
      <div id="divider" className="w-px bg-gray-200 h-full"></div>
      <div
        id="external chat-history"
        className="w-60 md:w-64 h-full  py-10 pt-5 flex flex-col justify-center items-start"
      >
        <div className="w-full px-4">
          <SearchField name="search">
            <SearchField.Group
              className={
                "rounded-2xl border border-solid border-[#e9e9e9] gap-2 py-2  shadow-none"
              }
            >
              <SearchField.SearchIcon />
              <SearchField.Input
                className="w-full resize-none border-0 bg-transparent p-0 text-base outline-none [scrollbar-width:none] focus:outline-none"
                placeholder="Search..."
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        <div className="w-full bg-gray-200 h-px my-4"></div>
        <div className="w-full flex-1 overflow-y-auto px-2">
          <ListBox
            aria-label="Users"
            className="w-full gap-2"
            selectionMode="single"
          >
            <ChatHistoryItem
              id="1"
              textValue="You known AI Agent?"
              color="bg-amber-400"
              createdAt="3天"
            />
            <ChatHistoryItem
              id="2"
              textValue="Are you an AI agent?"
              color="bg-blue-400"
              createdAt="1周"
            />
            <ChatHistoryItem
              id="3"
              textValue="Give me a soft music?"
              color="bg-green-400"
              createdAt="1天"
            />
          </ListBox>
        </div>
      </div>
      <div id="divider" className="w-px bg-gray-200 h-full"></div>

      <div
        id="content-wrapper"
        className="flex h-full min-h-0 flex-1 flex-col items-center w-full px-5 max-w-150 md:max-w-250 justify-center py-10 m-auto gap-4"
      >
        <div
          id="chat-messages"
          className="w-full min-h-0 flex-1 flex flex-col gap-5"
        >
          <div className="w-full h-full flex justify-between">
            <div className="w-[80%] shrink-0 h-full flex flex-col gap-4 overflow-y-auto scrollbar-hide">
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
            <div className="w-[20%] h-full">
              <ChatRecordLift />
            </div>
          </div>
        </div>
        <ChatInput />
      </div>
    </main>
  );
}
