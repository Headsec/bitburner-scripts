/** WGH SCRIPT
 * ==========================================
 * @USAGE
 * ==========================================
 * Run with defaults:
 *   run wgh.js foodnstuff
 *
 * Run with custom thresholds:
 *   run wgh.js foodnstuff 0.60 5 0.35
 *
 * Run with threads (threads flag comes BEFORE script args):
 *   run wgh.js -t 5 foodnstuff 0.60 5 0.35
 *
 * Args:
 *   [0] target           (string)  server to hack
 *   [1] moneyThreshold   (0..1)    grow if money < max * threshold
 *   [2] securityBuffer   (number)  weaken if sec > min + buffer
 *   [3] minHackChance    (0..1)    skip hack if chance too low
 * ==========================================
 */

/** @param {NS} ns */
export async function main(ns) {
  // ---- Args / Defaults ----
  const target = ns.args[0] ?? "n00dles";
  const moneyThreshold = Number(ns.args[1] ?? 0.60);
  const securityBuffer = Number(ns.args[2] ?? 5);
  const minHackChance = Number(ns.args[3] ?? 0.35);

  // Threads this instance is running with (from `run ... -t X`)
  const scriptThreads = Math.max(1, Math.floor(ns.getRunningScript().threads));

  // ---- Reduce log noise ----
  ns.disableLog("sleep");
  ns.disableLog("getServerSecurityLevel");
  ns.disableLog("getServerMinSecurityLevel");
  ns.disableLog("getServerMoneyAvailable");
  ns.disableLog("getServerMaxMoney");

  // ---- Formatting helpers ----
  const fmtPct = (x) => ns.formatPercent(x, 1);
  const fmtMoney = (n) => `$${ns.formatNumber(n, 3)}`;

  // ---- Startup log ----
  const host = ns.getHostname();
  ns.print(
    `HOST=${host} TARGET=${target} t=${scriptThreads} ` +
    `moneyThresh=${moneyThreshold} secBuf=${securityBuffer} minChance=${minHackChance}`
  );

  // ---- Main loop ----
  while (true) {
    // Wait until we have root access
    if (!ns.hasRootAccess(target)) {
      ns.print(`[${target}] No root access yet. Sleeping...`);
      await ns.sleep(5000);
      continue;
    }

    // Read server state
    const sec = ns.getServerSecurityLevel(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const moneyRatio = maxMoney > 0 ? money / maxMoney : 0;

    // 1) weaken if security is too high
    if (sec > minSec + securityBuffer) {
      ns.print(
        `[${target}] WEAKEN | t=${scriptThreads} ` +
        `sec ${sec.toFixed(2)} > ${(minSec + securityBuffer).toFixed(2)}`
      );
      await ns.weaken(target, { threads: scriptThreads });
      continue;
    }

    // 2) grow if money is below threshold
    // Never let the grow threshold be below 5% to avoid "penny hacking" a drained server.
    const growThreshold = Math.max(moneyThreshold, 0.05);

    if (maxMoney > 0 && moneyRatio < growThreshold) {
      ns.print(
        `[${target}] GROW | t=${scriptThreads} ` +
        `money ${fmtMoney(money)} / ${fmtMoney(maxMoney)} ` +
        `(${fmtPct(moneyRatio)}) < ${fmtPct(growThreshold)}`
      );
      await ns.grow(target, { threads: scriptThreads });
      continue;
    }

    // 3) skip hack if chance too low
    const chance = ns.hackAnalyzeChance(target);

    if (chance < minHackChance) {
      if (sec > minSec + 0.5) {
        ns.print(`[${target}] SKIP HACK | chance ${fmtPct(chance)} low → WEAKEN`);
        await ns.weaken(target, { threads: scriptThreads });
      } else {
        ns.print(`[${target}] SKIP HACK | chance ${fmtPct(chance)} low at minSec → SLEEP`);
        await ns.sleep(2000);
      }
      continue;
    }

    // 4) hack with a capped number of threads (avoid draining small targets)
    const stealFrac = 0.10;               // aim to steal ~10% of max money per cycle
    const desired = maxMoney * stealFrac;

    let hackThreadsTarget = ns.hackAnalyzeThreads(target, desired);
    if (!Number.isFinite(hackThreadsTarget) || hackThreadsTarget <= 0) hackThreadsTarget = 1;
    hackThreadsTarget = Math.floor(hackThreadsTarget);

    const hackThreads = Math.min(scriptThreads, hackThreadsTarget);

    ns.print(
      `[${target}] HACK | t=${hackThreads}/${scriptThreads} ` +
      `chance ${fmtPct(chance)} | ` +
      `money ${fmtMoney(money)} / ${fmtMoney(maxMoney)} ` +
      `(${fmtPct(moneyRatio)})`
    );

    await ns.hack(target, { threads: hackThreads });
  }
}
