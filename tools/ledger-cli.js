#!/usr/bin/env node
// node tools/ledger-cli.js <notes.md> <generation.json> -> verdict JSON on stdout.

import fs from "node:fs";
import { ledger } from "../core/ledger.js";

const [, , notesPath, generationPath] = process.argv;

if (!notesPath || !generationPath) {
  console.error("usage: node tools/ledger-cli.js <notes.md> <generation.json>");
  process.exit(1);
}

const notes = fs.readFileSync(notesPath, "utf8");
const generation = JSON.parse(fs.readFileSync(generationPath, "utf8"));
const sentences = generation.data?.sentences ?? generation.sentences ?? [];

const result = ledger(notes, sentences);
console.log(JSON.stringify(result, null, 2));
