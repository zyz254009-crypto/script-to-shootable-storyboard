#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, "..");
const SKILL_PATH = resolve(SKILL_DIR, "SKILL.md");
const AGENT_PATH = resolve(SKILL_DIR, "agents", "openai.yaml");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("SKILL.md 缺少有效 YAML frontmatter。");

  const keys = [];
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) throw new Error(`无法解析 frontmatter 行：${line}`);
    keys.push(field[1]);
    values[field[1]] = field[2].replace(/^["']|["']$/g, "");
  }
  return { keys, values };
}

function validateLinks(content) {
  const missing = [];
  const expression = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of content.matchAll(expression)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(SKILL_DIR, target))) missing.push(target);
  }
  return [...new Set(missing)];
}

try {
  if (!existsSync(SKILL_PATH)) throw new Error("SKILL.md 不存在。");
  const content = readFileSync(SKILL_PATH, "utf8");
  const { keys, values } = parseFrontmatter(content);
  const unexpected = keys.filter((key) => !["name", "description"].includes(key));

  if (unexpected.length) {
    throw new Error(`frontmatter 含非允许字段：${unexpected.join(", ")}`);
  }
  if (keys.length !== 2 || !values.name || !values.description) {
    throw new Error("frontmatter 必须且只能包含非空 name 与 description。");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.name)) {
    throw new Error(`技能名不是合法 hyphen-case：${values.name}`);
  }
  if (values.name.length > 64) throw new Error("技能名超过 64 个字符。");
  if (values.description.length > 1024) throw new Error("description 超过 1024 个字符。");
  if (/[<>]/.test(values.description)) throw new Error("description 不得包含尖括号。");

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > 500) throw new Error(`SKILL.md 为 ${lineCount} 行，超过 500 行。`);
  if (/placeholder|TODO|待替换/i.test(content)) {
    throw new Error("SKILL.md 仍含占位文本。");
  }

  const missingLinks = validateLinks(content);
  if (missingLinks.length) {
    throw new Error(`SKILL.md 存在失效相对链接：${missingLinks.join(", ")}`);
  }

  if (!existsSync(AGENT_PATH)) throw new Error("agents/openai.yaml 不存在。");
  const agent = readFileSync(AGENT_PATH, "utf8");
  for (const key of ["display_name", "short_description", "default_prompt"]) {
    if (!new RegExp(`^\\s{2}${key}:\\s*.+$`, "m").test(agent)) {
      throw new Error(`agents/openai.yaml 缺少 ${key}。`);
    }
  }
  if (!agent.includes("$script-to-shootable-storyboard")) {
    throw new Error("default_prompt 未显式调用技能名。");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "passed",
        skill_name: values.name,
        skill_lines: lineCount,
        checked_links: [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].length,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  fail(error.message);
}
