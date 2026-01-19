/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0] ?? "n00dles";
  const moneyThreshold = Number(ns.args[1] ?? 0.80);
  const securityBuffer = Number(ns.args[2] ?? 3);

  while (true) {
    const sec = ns.getServerSecurityLevel(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    if(sec > minSec + securityBuffer) {
      await ns.weaken(target);
    } else if (maxMoney > 0 && money < maxMoney * moneyThreshold) {
      await ns.grow(target);
    } else {
      await ns.sleep(10000);
    }
  }
}
