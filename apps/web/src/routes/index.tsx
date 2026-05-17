import SidebarHeader from "@/components/Sidebar/SidebarHeader";
import { createFileRoute } from "@tanstack/react-router";

import SidebarItems from "@/components/Sidebar/SidebarItems";
import { Avatar, Label } from "@heroui/react";
import ChatBox from "@/components/Chat/ChatBox";
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
              <Avatar.Fallback>Nori</Avatar.Fallback>
            </Avatar>
            <Label>Nori</Label>
          </div>
        </div>
      </div>

      <div id="divider" className="w-px bg-gray-200 h-full"></div>
      <ChatBox />
      <div className="w-[14%] shrink-0 h-full px-5">
        <ChatRecordLift />
      </div>
    </main>
  );
}
