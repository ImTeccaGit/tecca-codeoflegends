import { describe, expect, it } from "vitest";
import {
  getModuleByPath,
  MAIN_NAVIGATION_MODULES,
  MODULES,
  NAVIGATION_MODULES,
} from "@/app/navigation";

describe("module registry", () => {
  it("has unique ids and paths", () => {
    expect(new Set(MODULES.map((module) => module.id)).size).toBe(
      MODULES.length,
    );
    expect(new Set(MODULES.map((module) => module.path)).size).toBe(
      MODULES.length,
    );
  });

  it("lists every section in the sidebar order", () => {
    expect(MAIN_NAVIGATION_MODULES.map((module) => module.id)).toEqual([
      "dashboard",
      "champions",
      "builds",
      "runes",
      "jungle",
      "live",
      "players",
      "matches",
      "analysis",
      "matchups",
    ]);
  });

  it("makes every module reachable, Settings included", () => {
    const reachable = new Set(NAVIGATION_MODULES.map((module) => module.id));
    for (const module of MODULES) {
      expect(reachable.has(module.id)).toBe(true);
    }
  });

  it("marks only the implemented modules as available", () => {
    const available = MODULES.filter((module) => module.status === "available");
    expect(available.map((module) => module.id).sort()).toEqual([
      "analysis",
      "champions",
      "dashboard",
      "jungle",
      "live",
      "matches",
      "matchups",
      "players",
      "settings",
    ]);
  });

  it("resolves nested routes to their module", () => {
    expect(getModuleByPath("/champions/ahri")?.id).toBe("champions");
    expect(getModuleByPath("/settings/")?.id).toBe("settings");
    expect(getModuleByPath("/")?.id).toBe("dashboard");
    expect(getModuleByPath("/does-not-exist")).toBeUndefined();
  });
});
