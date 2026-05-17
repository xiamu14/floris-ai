import { Card } from "@heroui/react";

export default function ChatBubbleExample() {
  return (
    <Card className=" items-stretch md:flex-row border-none shadow-none p-0!">
      <div className="relative h-35 w-full shrink-0 overflow-hidden rounded-2xl sm:h-30 sm:w-30">
        <img
          alt="Cherries"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover select-none"
          loading="lazy"
          src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/cherries.jpeg"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Card.Header className="gap-1">
          <Card.Title className="pr-8">Become an ACME Creator!</Card.Title>
          <Card.Description>
            Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam
            dolor sed amet faucibus etiam.
          </Card.Description>
        </Card.Header>
      </div>
    </Card>
  );
}
