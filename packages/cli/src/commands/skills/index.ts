import { Command } from "commander";
import { syncSkillsCommand } from "./sync.js";

export function createSkillsCommand(): Command {
  const skills = new Command("skills").description("Manage agent skills");
  skills.addCommand(syncSkillsCommand());
  return skills;
}

export * from "./sync.js";
