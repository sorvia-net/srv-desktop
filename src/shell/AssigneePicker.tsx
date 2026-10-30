import { Check } from "lucide-react";

import type { ChatPerson } from "@shared/contracts";
import { peopleApi } from "@/data/api";
import { useQuery } from "@/data/query";
import { Avatar, cn } from "@/design/ui";

import { useSession } from "./context";

export function canAssign(role: string) {
  return ["MODERATOR", "ADMIN", "OWNER"].includes(role);
}

export function AssigneePicker({ value, onChange }: { value: string | null; onChange: (userId: string) => void }) {
  const session = useSession();
  const people = useQuery<ChatPerson[]>("chat:people", () => peopleApi.list(), { refreshMs: 60_000 });
  const me = session.user.id;
  const list = [{ id: me, name: "Ben", avatarUrl: session.user.avatarUrl, online: true }, ...(people.data ?? []).filter((person) => person.id !== me)];
  const selected = value ?? me;
  return (
    <div className="flex max-h-[132px] flex-wrap gap-1.5 overflow-y-auto">
      {list.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onChange(person.id)}
          className={cn("flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12.5px] font-medium transition-colors", selected === person.id ? "accent-fill" : "bg-white/8 text-ink-2 hover:bg-white/12")}
        >
          <span className="relative">
            <Avatar name={person.id === me ? session.user.name : person.name} src={person.avatarUrl} size={26} />
            {person.online && person.id !== me && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-[#1b1b1f]" />}
          </span>
          {person.name}
          {selected === person.id && <Check className="size-3.5" />}
        </button>
      ))}
    </div>
  );
}
