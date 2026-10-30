import { createContext } from "react";

export const BadgeContext = createContext<Partial<Record<string, number>>>({});
