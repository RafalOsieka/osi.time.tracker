#!/usr/bin/env node
// Read-only helper for the compact-specs skill. It measures and compares specs;
// it never writes spec text. Run from the repository root:
//
//   node <skill>/scripts/spec-inventory.mjs overview [spec...]   sizes, Purpose length, overlong requirements
//   node <skill>/scripts/spec-inventory.mjs index [spec...]      Purpose + one line per requirement, for spotting overlaps
//   node <skill>/scripts/spec-inventory.mjs snapshot <out.json>  full inventory (baseline for `diff`)
//   node <skill>/scripts/spec-inventory.mjs refs                 REQ codes referenced outside openspec/, and dangling ones
//   node <skill>/scripts/spec-inventory.mjs diff <before.json> [spec...]
//                                                                what disappeared, moved or changed wording since the snapshot
//
// [spec...] limits output to those spec ids (e.g. tracking-api) or id prefixes (e.g. tracking-).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SPECS_DIR = 'openspec/specs';
const MAX_REQ = 500;
const MIN_PURPOSE = 50;
const CODE_RE = /\bREQ-\d{3,}\b/g;
const RETIRED_FILE = 'docs/retired-requirements.md';

function findSpecFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findSpecFiles(path);
    return entry.name === 'spec.md' ? [path] : [];
  });
}

// Splits a spec into Purpose and requirement blocks; headers inside code fences are ignored.
function parseSpec(text) {
  const spec = { purpose: '', requirements: [] };
  let section = null;
  let req = null;
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && /^## /.test(line)) {
      section = line.slice(3).trim().toLowerCase();
      req = null;
      continue;
    }
    if (!inFence && /^### Requirement:/.test(line)) {
      const header = line.replace(/^### Requirement:\s*/, '').trim();
      req = { header, code: header.match(/^REQ-\d{3,}/)?.[0] ?? null, text: '', scenarios: [], body: '' };
      spec.requirements.push(req);
      continue;
    }
    if (!inFence && /^#### Scenario:/.test(line) && req) {
      req.scenarios.push(line.replace(/^#### Scenario:\s*/, '').trim());
      req.body += line + '\n';
      continue;
    }
    if (req) {
      if (req.scenarios.length === 0) req.text += line + '\n';
      req.body += line + '\n';
    } else if (section === 'purpose') {
      spec.purpose += line + '\n';
    }
  }
  spec.purpose = spec.purpose.trim();
  for (const r of spec.requirements) r.text = r.text.trim();
  return spec;
}

function loadSpecs() {
  const specs = {};
  for (const file of findSpecFiles(SPECS_DIR).sort()) {
    const id = relative(SPECS_DIR, file).split(sep).slice(0, -1).join('/');
    const text = readFileSync(file, 'utf8');
    specs[id] = { lines: text.split(/\r?\n/).length, ...parseSpec(text) };
  }
  return specs;
}

const matchesFilter = (filters) => (id) =>
  filters.length === 0 || filters.some((f) => id === f || id.startsWith(f));

// Each scenario bullet and each description paragraph is split into sentences separately,
// so markdown structure never glues two unrelated lines into one "sentence".
const normativeSentences = (body) => {
  const chunks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) chunks.push(paragraph.join(' '));
    paragraph = [];
  };
  for (const line of body.split('\n')) {
    if (!line.trim() || /^#{1,6} /.test(line)) flush();
    else if (/^\s*[-*] /.test(line)) {
      flush();
      chunks.push(line.replace(/^\s*[-*] /, ''));
    } else paragraph.push(line.trim());
  }
  flush();
  return chunks
    .flatMap((c) => c.replace(/\s+/g, ' ').split(/(?<=[.;])\s+(?=[A-Z`*(])/))
    .filter((s) => /\b(SHALL|MUST|SHOULD|MAY)\b/.test(s))
    .map((s) => s.trim());
};

const firstSentence = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.;](\s|$)/);
  const sentence = end === -1 ? flat : flat.slice(0, end + 1);
  return sentence.length > 220 ? sentence.slice(0, 217) + '...' : sentence;
};

function overview(filters) {
  const specs = loadSpecs();
  const rows = Object.entries(specs).filter(([id]) => matchesFilter(filters)(id));
  let totals = { lines: 0, reqs: 0, scenarios: 0, long: 0 };
  console.log('spec | lines | purpose chars | reqs | scenarios | reqs >500 (chars)');
  for (const [id, s] of rows) {
    const long = s.requirements.filter((r) => r.text.length > MAX_REQ);
    const scenarios = s.requirements.reduce((n, r) => n + r.scenarios.length, 0);
    const purposeFlag = s.purpose.length < MIN_PURPOSE ? ' (too short)' : '';
    const longList = long.map((r) => `${r.code ?? r.header.slice(0, 30)} (${r.text.length})`).join(', ');
    console.log(`${id} | ${s.lines} | ${s.purpose.length}${purposeFlag} | ${s.requirements.length} | ${scenarios} | ${long.length}${longList ? ': ' + longList : ''}`);
    totals = {
      lines: totals.lines + s.lines,
      reqs: totals.reqs + s.requirements.length,
      scenarios: totals.scenarios + scenarios,
      long: totals.long + long.length,
    };
  }
  console.log(`TOTAL ${rows.length} specs | ${totals.lines} lines | ${totals.reqs} reqs | ${totals.scenarios} scenarios | ${totals.long} reqs >500`);
}

function index(filters) {
  const specs = loadSpecs();
  for (const [id, s] of Object.entries(specs).filter(([id]) => matchesFilter(filters)(id))) {
    console.log(`\n## ${id}\nPurpose: ${s.purpose.replace(/\s+/g, ' ')}`);
    for (const r of s.requirements) console.log(`- ${r.header}: ${firstSentence(r.text)}`);
  }
}

function snapshot(out) {
  if (!out) throw new Error('usage: snapshot <out.json>');
  writeFileSync(out, JSON.stringify(loadSpecs(), null, 2));
  console.log(`snapshot written: ${out}`);
}

// REQ codes outside openspec/ (tracked files only, so node_modules and build output are skipped).
// Codes listed in the retired-codes file count as retired, not dangling.
function refs() {
  const defined = new Set(
    Object.values(loadSpecs()).flatMap((s) => s.requirements.map((r) => r.code).filter(Boolean)),
  );
  // Only the first table column names a retired code; later columns may point to surviving codes.
  // Rows marked "(not retired)" record a code that only moved to another spec.
  const retired = new Set(
    existsSync(RETIRED_FILE)
      ? readFileSync(RETIRED_FILE, 'utf8')
          .split(/\r?\n/)
          .filter((line) => !/not retired/i.test(line))
          .map((line) => line.match(/^\|\s*(REQ-\d{3,})\s*\|/)?.[1])
          .filter(Boolean)
      : [],
  );
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-n', '-o', '-E', 'REQ-[0-9]{3,}', '--', '.', ':(exclude)openspec', `:(exclude)${RETIRED_FILE}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    if (e.status !== 1) throw e; // status 1 = no matches
  }
  const byCode = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [file, , code] = line.split(':');
    if (!byCode.has(code)) byCode.set(code, new Set());
    byCode.get(code).add(file);
  }
  const codes = [...byCode.keys()].sort();
  const dangling = codes.filter((c) => !defined.has(c) && !retired.has(c));
  const retiredInUse = codes.filter((c) => !defined.has(c) && retired.has(c));
  const reused = [...defined].filter((c) => retired.has(c)).sort();
  console.log(`${codes.length} codes referenced outside openspec/, ${defined.size} defined in specs, ${retired.size} retired`);
  const printList = (title, list) => {
    console.log(`${title}: ${list.length ? '' : 'none'}`);
    for (const c of list) console.log(`  ${c}${byCode.has(c) ? ': ' + [...byCode.get(c)].join(', ') : ''}`);
  };
  printList('dangling (referenced, neither in a spec nor retired)', dangling);
  printList('retired but still referenced', retiredInUse);
  printList('retired code reused in a spec', reused);
  console.log('references:');
  for (const c of codes) console.log(`  ${c}: ${[...byCode.get(c)].join(', ')}`);
}

// Compares a snapshot with the current specs. Lists only what needs a human look:
// removed/moved requirements and scenarios, and normative sentences whose exact wording is gone.
function diff(beforePath, filters) {
  if (!beforePath) throw new Error('usage: diff <before.json> [spec...]');
  const before = JSON.parse(readFileSync(beforePath, 'utf8'));
  const after = loadSpecs();
  const inScope = matchesFilter(filters);
  const locate = (specs) => {
    const reqs = new Map();
    const scenarios = new Map();
    for (const [id, s] of Object.entries(specs)) {
      for (const r of s.requirements) {
        reqs.set(r.code ?? r.header, { id, r });
        for (const name of r.scenarios) scenarios.set(`${name}`, [...(scenarios.get(name) ?? []), id]);
      }
    }
    return { reqs, scenarios };
  };
  const b = locate(before);
  const a = locate(after);
  const afterText = Object.values(after)
    .flatMap((s) => s.requirements.map((r) => r.body))
    .join('\n')
    .replace(/\s+/g, ' ');

  const sections = { removedReqs: [], movedReqs: [], newReqs: [], removedScenarios: [], changedNormative: [] };
  for (const [key, { id, r }] of b.reqs) {
    if (!inScope(id)) continue;
    const now = a.reqs.get(key);
    if (!now) sections.removedReqs.push(`${id}: ${r.header}`);
    else if (now.id !== id) sections.movedReqs.push(`${key}: ${id} -> ${now.id}`);
    for (const name of r.scenarios) {
      if (!a.scenarios.has(name)) sections.removedScenarios.push(`${id} ${key}: ${name}`);
    }
    for (const sentence of normativeSentences(r.body)) {
      if (!afterText.includes(sentence.replace(/\s+/g, ' '))) sections.changedNormative.push(`${id} ${key}: ${sentence}`);
    }
  }
  for (const [key, { id, r }] of a.reqs) {
    if (inScope(id) && !b.reqs.has(key)) sections.newReqs.push(`${id}: ${r.header}`);
  }
  const print = (title, list) => {
    console.log(`\n${title} (${list.length})`);
    for (const item of list) console.log(`  ${item}`);
  };
  print('Requirements gone (merged, moved to docs, dropped or renamed without code)', sections.removedReqs);
  print('Requirements moved to another spec', sections.movedReqs);
  print('New requirements (splits)', sections.newReqs);
  print('Scenarios gone (check each against the decision log)', sections.removedScenarios);
  print('Normative sentences whose exact wording is gone (check meaning, qualifiers, strength)', sections.changedNormative);
}

const [mode, ...args] = process.argv.slice(2);
const modes = {
  overview: () => overview(args),
  index: () => index(args),
  snapshot: () => snapshot(args[0]),
  refs: () => refs(),
  diff: () => diff(args[0], args.slice(1)),
};
if (!modes[mode]) {
  console.error('usage: spec-inventory.mjs <overview|index|snapshot|refs|diff> [...]');
  process.exit(2);
}
modes[mode]();
