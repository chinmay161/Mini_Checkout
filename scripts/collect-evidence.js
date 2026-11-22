/**
 * scripts/collect-evidence.js
 *
 * Machine-generates all evidence files and writes evidence/SUMMARY.md.
 * Designed to be run via: npm run evidence (or with --dry-run)
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const isDryRun = process.argv.includes('--dry-run');

// Strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

// Adapt line endings in search strings to match target file line endings
function adaptLineEndings(str, targetContent) {
  const isCrlf = targetContent.includes('\r\n');
  return isCrlf ? str.replace(/\r?\n/g, '\r\n') : str.replace(/\r?\n/g, '\n');
}

// Ensure target directory exists and write file
function saveEvidenceFile(relPath, content) {
  const fullPath = path.join(ROOT_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

// Check git status before proceeding
function assertCleanWorkingTree() {
  const res = child_process.spawnSync('git status --porcelain -- public tests', {
    cwd: ROOT_DIR,
    shell: true,
    encoding: 'utf8'
  });
  const output = (res.stdout || '').trim();
  if (output.length > 0) {
    console.error('ABORT: Working tree for public/ or tests/ is not clean.');
    console.error('The script temporarily edits public/ and must restore it.');
    console.error(output);
    process.exit(1);
  }
}

// Run a command with CI=1 and FORCE_COLOR=0, capturing verbatim output
function runCommand(cmd) {
  const startIso = new Date().toISOString();
  console.log(`[EXEC] ${cmd}`);
  const env = {
    ...process.env,
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1'
  };

  const res = child_process.spawnSync(cmd, {
    cwd: ROOT_DIR,
    shell: true,
    encoding: 'utf8',
    env
  });

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const combined = stripAnsi(stdout + stderr);
  const exitCode = res.status !== null ? res.status : (res.error ? 1 : 0);

  const formattedOutput = [
    `# Command: ${cmd}`,
    `# Timestamp: ${startIso}`,
    `# Exit Code: ${exitCode}`,
    '',
    combined
  ].join('\n');

  return {
    cmd,
    startIso,
    exitCode,
    rawOutput: combined,
    formattedOutput
  };
}

// Parse test pass/fail counts from command output
function parseTestSummary(rawOutput) {
  const passedMatch = rawOutput.match(/(\d+\s+passed[^\r\n]*)/i);
  const failedMatch = rawOutput.match(/(\d+\s+failed[^\r\n]*)/i);
  if (passedMatch && failedMatch) {
    return `${passedMatch[1]}, ${failedMatch[1]}`;
  }
  if (passedMatch) return passedMatch[1];
  if (failedMatch) return failedMatch[1];
  return 'Completed';
}

// Parse probe summary numbers from probe.txt output
function parseProbeTotals(rawOutput) {
  const oneConf = rawOutput.match(/ONE_CONFIRMATION\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  const confLost = rawOutput.match(/CONFIRMATION_LOST\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  const multiple = rawOutput.match(/MULTIPLE\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  const other = rawOutput.match(/OTHER\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  const total = rawOutput.match(/TOTAL ATTEMPTS\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  const scenarios = rawOutput.match(/DISTINCT SCENARIOS TESTED\s*:\s*(\d+)/i)?.[1] ?? 'N/A';
  return { oneConf, confLost, multiple, other, total, scenarios };
}

// Table of 7 mutations
const MUTATIONS = [
  {
    id: 'M1',
    file: 'public/app.js',
    description: 'Remove early double-submit guard in submit handler',
    find: '  // If already placed, return immediately (double-submit guard)\n  if (orderPlaced || isSubmitting) {\n    return;\n  }',
    replace: '  // If already placed, return immediately (double-submit guard)',
    grep: 'scripted rapid submits',
    outfile: 'M1-guard-removed.txt'
  },
  {
    id: 'M2',
    file: 'public/app.js',
    description: 'Allow raw untrimmed name length to pass validation',
    find: 'const hasValidName = trimmedName.length > 0;',
    replace: 'const hasValidName = rawName.length > 0;',
    grep: 'missing name',
    outfile: 'M2-trim-removed.txt'
  },
  {
    id: 'M3',
    file: 'public/app.js',
    description: 'escapeHtml returns raw unescaped string',
    find: 'return div.innerHTML;',
    replace: 'return str;',
    grep: 'shown as text',
    outfile: 'M3-escape-removed.txt'
  },
  {
    id: 'M4',
    file: 'public/styles.css',
    description: 'Delete overflow-wrap: anywhere rule from confirmation card',
    find: '  overflow-wrap: anywhere;\n',
    replace: '',
    grep: 'long unbroken name',
    outfile: 'M4-wrap-removed.txt'
  },
  {
    id: 'M5',
    file: 'public/app.js',
    description: 'Clear name error on raw untrimmed input length',
    find: 'if (nameInput.value.trim().length > 0) {',
    replace: 'if (nameInput.value.length > 0) {',
    grep: 'errors clear',
    outfile: 'M5-name-clear-untrimmed.txt'
  },
  {
    id: 'M6',
    file: 'public/app.js',
    description: 'Relax parseValidQuantity upper bound from 99 to 999',
    find: 'if (!Number.isInteger(num) || num < 1 || num > 99) return null;',
    replace: 'if (!Number.isInteger(num) || num < 1 || num > 999) return null;',
    grep: 'invalid quantity',
    outfile: 'M6-max-quantity-removed.txt'
  },
  {
    id: 'M7',
    file: 'public/app.js',
    description: 'Remove 600 ms disabled delay on Start new order button',
    find: 'newOrderBtn.disabled = true;',
    replace: 'newOrderBtn.disabled = false;',
    grep: 'short window',
    outfile: 'M7-new-order-delay-removed.txt'
  }
];

function main() {
  console.log('=== Collect Evidence Script ===');
  console.log(`Root Directory: ${ROOT_DIR}`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no commands run, no files modified)' : 'LIVE EXECUTION'}`);

  // Step 1: Pre-flight checks
  assertCleanWorkingTree();
  console.log('[OK] Working tree for public/ and tests/ is clean.');

  // Verify mutation patterns in original files
  for (const m of MUTATIONS) {
    const fullPath = path.join(ROOT_DIR, m.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const targetFind = adaptLineEndings(m.find, content);
    const count = content.split(targetFind).length - 1;
    if (count !== 1) {
      console.error(`ABORT: Mutation ${m.id} find string occurred ${count} times in ${m.file} (expected exactly 1).`);
      process.exit(1);
    }
  }
  console.log('[OK] All 7 mutation find strings occur exactly once.');

  if (isDryRun) {
    console.log('\n--- DRY RUN PLAN ---');
    console.log('1. Capture Environment -> evidence/automated/environment.txt');
    console.log('2. Automated Test Runs:');
    console.log('   - npx playwright test -> evidence/automated/npm-test.txt');
    console.log('   - npx playwright test --repeat-each=5 -> evidence/automated/repeat-each-5.txt');
    console.log('   - npx playwright test --workers=1 -> evidence/automated/workers-1.txt');
    console.log('   - npx playwright test -c playwright.exploratory.config.js -> evidence/automated/probe.txt');
    console.log('3. DEF-001 Before/After Check:');
    console.log('   - Write baseline git show e4a7e45:public/app.js');
    console.log('   - Run npx playwright test -g "short window" -> evidence/DEF-001/before-tests.txt (must fail)');
    console.log('   - Restore public/app.js');
    console.log('   - Run npx playwright test -g "short window" -> evidence/DEF-001/after-tests.txt (must pass)');
    console.log('4. Mutation Checks (7 mutations):');
    MUTATIONS.forEach(m => {
      console.log(`   - ${m.id}: ${m.description} (${m.file}) -> grep "${m.grep}" -> evidence/mutation/${m.outfile}`);
    });
    console.log('5. Restored Suite Verification:');
    console.log('   - npx playwright test -> evidence/mutation/restored-suite.txt');
    console.log('   - git diff --exit-code -- public');
    console.log('6. Summary Report:');
    console.log('   - Generate evidence/SUMMARY.md with tables of all runs, probe metrics, and mutation results.');
    console.log('\n[DRY RUN COMPLETE] Plan verified successfully. No files were modified.');
    return;
  }

  // Live execution tracks results for SUMMARY.md
  const commandResults = [];
  const mutationResults = [];
  let probeMetrics = null;

  // Cleanup handler for unexpected termination
  let activeMutation = null;
  function emergencyRestore() {
    if (activeMutation) {
      try {
        fs.writeFileSync(activeMutation.fullPath, activeMutation.originalContent, 'utf8');
        console.log(`[RESTORED] Cleaned up ${activeMutation.file} on exit.`);
      } catch (err) {
        console.error(`[ERROR] Failed to restore ${activeMutation.file}:`, err);
      }
    }
  }
  process.on('SIGINT', () => {
    emergencyRestore();
    process.exit(130);
  });
  process.on('uncaughtException', (err) => {
    emergencyRestore();
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  // Step 2: Capture Environment
  console.log('\n--- Step 1: Environment ---');
  let playwrightVersion = 'not captured';
  try {
    const pwRes = child_process.spawnSync('npx playwright --version', { shell: true, encoding: 'utf8', cwd: ROOT_DIR });
    playwrightVersion = (pwRes.stdout || '').trim();
  } catch (e) {}

  let npmVersion = 'not captured';
  try {
    const npmRes = child_process.spawnSync('npm --version', { shell: true, encoding: 'utf8', cwd: ROOT_DIR });
    npmVersion = (npmRes.stdout || '').trim();
  } catch (e) {}

  let chromiumVersion = 'not captured';
  try {
    const crRes = child_process.spawnSync(
      'node -e "require(\'@playwright/test\').chromium.launch().then(b => { console.log(b.version()); return b.close(); })"',
      { shell: true, encoding: 'utf8', cwd: ROOT_DIR }
    );
    if (crRes.stdout && crRes.stdout.trim()) chromiumVersion = crRes.stdout.trim();
  } catch (e) {}

  let nodeEngineRequirement = 'not captured';
  try {
    const pwPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'node_modules/@playwright/test/package.json'), 'utf8'));
    nodeEngineRequirement = pwPkg.engines?.node ?? 'not specified';
  } catch (e) {}

  const envContent = [
    `# Environment Details`,
    `# Captured: ${new Date().toISOString()}`,
    `OS Platform / Release: ${os.type()} ${os.release()} (${os.arch()})`,
    `Node.js: ${process.version}`,
    `Node Engines Requirement: ${nodeEngineRequirement}`,
    `npm: ${npmVersion}`,
    `Playwright: ${playwrightVersion}`,
    `Chromium: ${chromiumVersion}`
  ].join('\n');
  saveEvidenceFile('evidence/automated/environment.txt', envContent);

  // Step 3: Automated Test Runs
  console.log('\n--- Step 2: Automated Test Runs ---');
  const automatedRuns = [
    { cmd: 'npx playwright test', file: 'evidence/automated/npm-test.txt', label: 'Full Test Suite' },
    { cmd: 'npx playwright test --repeat-each=5', file: 'evidence/automated/repeat-each-5.txt', label: 'Repeat Each 5' },
    { cmd: 'npx playwright test --workers=1', file: 'evidence/automated/workers-1.txt', label: 'Workers 1' },
    { cmd: 'npx playwright test -c playwright.exploratory.config.js', file: 'evidence/automated/probe.txt', label: 'Exploratory Probe' }
  ];

  for (const run of automatedRuns) {
    const res = runCommand(run.cmd);
    saveEvidenceFile(run.file, res.formattedOutput);
    const summary = parseTestSummary(res.rawOutput);
    commandResults.push({
      label: run.label,
      cmd: run.cmd,
      exitCode: res.exitCode,
      summary,
      file: run.file
    });

    if (run.file.includes('probe.txt')) {
      probeMetrics = parseProbeTotals(res.rawOutput);
    }
  }

  // Step 4: DEF-001 Before/After Check
  console.log('\n--- Step 3: DEF-001 Before/After Check ---');
  const appJsPath = path.join(ROOT_DIR, 'public/app.js');
  const cleanAppJs = fs.readFileSync(appJsPath, 'utf8');

  try {
    const baselineRes = child_process.spawnSync('git show e4a7e45:public/app.js', {
      cwd: ROOT_DIR,
      shell: true,
      encoding: 'utf8'
    });
    if (baselineRes.status !== 0 || !baselineRes.stdout) {
      throw new Error('Failed to retrieve baseline public/app.js from git e4a7e45');
    }

    activeMutation = { file: 'public/app.js', fullPath: appJsPath, originalContent: cleanAppJs };
    fs.writeFileSync(appJsPath, baselineRes.stdout, 'utf8');

    const beforeRes = runCommand('npx playwright test -g "short window"');
    saveEvidenceFile('evidence/DEF-001/before-tests.txt', beforeRes.formattedOutput);
    if (beforeRes.exitCode === 0) {
      console.warn('WARNING: DEF-001 baseline run unexpectedly passed!');
    } else {
      console.log('[OK] DEF-001 baseline failed as expected.');
    }
    commandResults.push({
      label: 'DEF-001 Baseline (Red)',
      cmd: 'npx playwright test -g "short window"',
      exitCode: beforeRes.exitCode,
      summary: parseTestSummary(beforeRes.rawOutput),
      file: 'evidence/DEF-001/before-tests.txt'
    });
  } finally {
    fs.writeFileSync(appJsPath, cleanAppJs, 'utf8');
    activeMutation = null;
    const restoredCheck = fs.readFileSync(appJsPath, 'utf8');
    if (restoredCheck !== cleanAppJs) {
      console.error('ABORT: Failed to restore public/app.js byte-for-byte.');
      process.exit(1);
    }
  }

  const afterRes = runCommand('npx playwright test -g "short window"');
  saveEvidenceFile('evidence/DEF-001/after-tests.txt', afterRes.formattedOutput);
  if (afterRes.exitCode !== 0) {
    console.error('ERROR: DEF-001 post-fix run failed!');
  } else {
    console.log('[OK] DEF-001 post-fix passed as expected.');
  }
  commandResults.push({
    label: 'DEF-001 Fixed (Green)',
    cmd: 'npx playwright test -g "short window"',
    exitCode: afterRes.exitCode,
    summary: parseTestSummary(afterRes.rawOutput),
    file: 'evidence/DEF-001/after-tests.txt'
  });

  // Step 5: Mutation Testing (M1–M7)
  console.log('\n--- Step 4: Mutation Testing (M1–M7) ---');
  let anyMutationSurvived = false;

  for (const m of MUTATIONS) {
    const targetPath = path.join(ROOT_DIR, m.file);
    const originalContent = fs.readFileSync(targetPath, 'utf8');
    activeMutation = { file: m.file, fullPath: targetPath, originalContent };

    try {
      const adaptedFind = adaptLineEndings(m.find, originalContent);
      const adaptedReplace = adaptLineEndings(m.replace, originalContent);
      const mutatedContent = originalContent.replace(adaptedFind, adaptedReplace);

      fs.writeFileSync(targetPath, mutatedContent, 'utf8');
      const testCmd = `npx playwright test -g "${m.grep}"`;
      const res = runCommand(testCmd);
      saveEvidenceFile(`evidence/mutation/${m.outfile}`, res.formattedOutput);

      const hasFailedTest = res.rawOutput.includes('failed') || res.rawOutput.includes('x ');
      const isKilled = res.exitCode !== 0 && hasFailedTest;
      const status = isKilled ? 'KILLED' : 'SURVIVED';
      if (!isKilled) anyMutationSurvived = true;

      const firstErrorLine = res.rawOutput.split('\n').find(l => l.trim().startsWith('Error:'))?.trim() || 'None reported';

      mutationResults.push({
        id: m.id,
        file: m.file,
        description: m.description,
        grep: m.grep,
        status,
        firstError: firstErrorLine,
        outfile: `evidence/mutation/${m.outfile}`
      });

      console.log(`[MUTATION ${m.id}] ${status}: ${m.description}`);
    } finally {
      fs.writeFileSync(targetPath, originalContent, 'utf8');
      activeMutation = null;
      const verified = fs.readFileSync(targetPath, 'utf8');
      if (verified !== originalContent) {
        console.error(`ABORT: Failed to restore ${m.file} byte-for-byte after ${m.id}.`);
        process.exit(1);
      }
    }
  }

  // Step 6: Restored Suite Verification
  console.log('\n--- Step 5: Restored Suite Verification ---');
  const restoredRes = runCommand('npx playwright test');
  saveEvidenceFile('evidence/mutation/restored-suite.txt', restoredRes.formattedOutput);

  const gitDiffRes = child_process.spawnSync('git diff --exit-code -- public', {
    cwd: ROOT_DIR,
    shell: true,
    encoding: 'utf8'
  });
  const gitClean = gitDiffRes.status === 0;
  console.log(`[RESTORED STATUS] git diff --exit-code -- public: ${gitClean ? 'CLEAN (0)' : 'DIRTY (' + gitDiffRes.status + ')'}`);

  // Step 7: Generate evidence/SUMMARY.md
  console.log('\n--- Step 6: Generating evidence/SUMMARY.md ---');
  const summaryLines = [
    '# Evidence Execution Summary',
    '',
    `**Generated**: ${new Date().toISOString()}`,
    `**Environment**: ${os.type()} ${os.release()} (${os.arch()}) | Node: ${process.version} | npm: ${npmVersion}`,
    `**Playwright**: ${playwrightVersion} | Chromium: ${chromiumVersion}`,
    '',
    '## 1. Automated Test Execution Commands',
    '',
    '| Test Run / Target | Command | Exit Code | Result | Evidence File |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...commandResults.map(r => `| **${r.label}** | \`${r.cmd}\` | ${r.exitCode} | ${r.summary} | [${r.file}](../${r.file}) |`),
    '',
    '## 2. Exploratory Layout Shift Probe Totals',
    '',
    `Parsed from [evidence/automated/probe.txt](../evidence/automated/probe.txt):`,
    '',
    '| Metric | Value |',
    '| :--- | :--- |',
    `| **ONE_CONFIRMATION** | ${probeMetrics?.oneConf ?? 'N/A'} |`,
    `| **CONFIRMATION_LOST** | ${probeMetrics?.confLost ?? 'N/A'} |`,
    `| **MULTIPLE** | ${probeMetrics?.multiple ?? 'N/A'} |`,
    `| **OTHER** | ${probeMetrics?.other ?? 'N/A'} |`,
    `| **Total Attempts** | ${probeMetrics?.total ?? 'N/A'} |`,
    `| **Distinct Scenarios Tested** | ${probeMetrics?.scenarios ?? 'N/A'} |`,
    '',
    '## 3. Mutation Testing Results (M1–M7)',
    '',
    '| ID | File | Description | Grep Filter | Status | First Error Line | Evidence File |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
    ...mutationResults.map(m => `| **${m.id}** | \`${m.file}\` | ${m.description} | \`${m.grep}\` | **${m.status}** | \`${m.firstError.replace(/\|/g, '\\|')}\` | [${m.outfile}](../${m.outfile}) |`),
    '',
    '## 4. Final Verification',
    '',
    `- **Restored Test Suite**: \`${parseTestSummary(restoredRes.rawOutput)}\` (Exit Code: ${restoredRes.exitCode})`,
    `- **Git Tree Cleanliness**: \`git diff --exit-code -- public\` -> ${gitClean ? '**CLEAN** (0 diff)' : '**DIRTY**'}`,
    `- **Overall Status**: ${(!anyMutationSurvived && restoredRes.exitCode === 0 && gitClean) ? '**ALL CHECKS PASSED**' : '**FAILURES DETECTED**'}`
  ];

  saveEvidenceFile('evidence/SUMMARY.md', summaryLines.join('\n') + '\n');
  console.log('[OK] Generated evidence/SUMMARY.md successfully.');

  if (anyMutationSurvived || restoredRes.exitCode !== 0 || !gitClean) {
    console.error('\nEXECUTION FAILED: One or more mutations survived, restored suite failed, or public/ is dirty.');
    process.exit(1);
  }

  console.log('\n=== All Evidence Collected and Verified Cleanly ===');
}

main();
