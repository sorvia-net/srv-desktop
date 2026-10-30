import * as appearance from "@shared/appearance";
import * as contracts from "@shared/contracts";
import * as shortcuts from "@shared/shortcuts";
import * as lucide from "lucide-react";
import * as motion from "motion/react";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as reactDom from "react-dom";

import * as api from "@/data/api";
import * as bridge from "@/data/bridge";
import * as feed from "@/data/feed";
import * as format from "@/data/format";
import * as hello from "@/data/hello";
import * as query from "@/data/query";
import * as sound from "@/data/sound";
import * as transfers from "@/data/transfers";
import * as voice from "@/data/voice";
import * as chart from "@/design/chart";
import * as logo from "@/design/logo";
import * as ui from "@/design/ui";
import * as icons from "@/os/icons";
import * as osModules from "@/os/modules";
import * as registry from "@/os/registry";
import * as state from "@/os/state";
import * as statusBar from "@/os/StatusBar";
import * as assignee from "@/shell/AssigneePicker";
import * as ask from "@/shell/ask";
import * as context from "@/shell/context";

export const SHARED: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "react-dom": reactDom,
  "lucide-react": lucide,
  "motion/react": motion,
  "@shared/appearance": appearance,
  "@shared/contracts": contracts,
  "@shared/shortcuts": shortcuts,
  "@/data/api": api,
  "@/data/bridge": bridge,
  "@/data/feed": feed,
  "@/data/format": format,
  "@/data/hello": hello,
  "@/data/query": query,
  "@/data/sound": sound,
  "@/data/transfers": transfers,
  "@/data/voice": voice,
  "@/design/chart": chart,
  "@/design/logo": logo,
  "@/design/ui": ui,
  "@/os/icons": icons,
  "@/os/modules": osModules,
  "@/os/registry": registry,
  "@/os/state": state,
  "@/os/StatusBar": statusBar,
  "@/shell/AssigneePicker": assignee,
  "@/shell/ask": ask,
  "@/shell/context": context,
};

export const SHARED_SPECIFIERS = Object.keys(SHARED);
