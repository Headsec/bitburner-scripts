/** NUKE.EXE SCRIPT
 * @USAGE
 * Run script to automate running NUKE.exe on servers
/** @param {NS} ns */
export async function main(ns) {

// disable automatic logging for clean output
ns.disableLog("ALL");

// maxhops - if no argument default is 3
const maxHops = Number(ns.args[0] ?? 3);

// scan the network starting from "home" server
const servers = scanWithinHops(ns, "home", maxHops)
  .filter(s => s !== "home"); // filter out home 

servers.sort(); // sort server names alphabetically for output

// counters so I can print a summary at the end 
let nuked = 0; // servers successfully nuked
let already = 0; // servers that already had root access
let failed = 0; // servers where nuke.exe failed

// print a header detailing what the script is about to do
ns.tprint(`Attempting NUKE.exe on ${servers.length} servers within ${maxHops} hops...`);

// if I already have root access then skip this server
for (const s of servers) {
  if (ns.hasRootAccess(s)) {
    already++; // increment "already rooted" counter
    ns.tprint(`SKIP: ${s} (already rooted)`); // inform
    continue; // move on
  }

// query how many ports this server requires before nuke can succeed
const requiredPorts = ns.getServerNumPortsRequired(s);

// try and run NUKE and catch any errors
try {
  ns.nuke(s);  // attempt to gain root

  if (ns.hasRootAccess(s)) {
    nuked++;  // count successful nukes
    ns.tprint(`NUKED: ${s} (requiredPorts=${requiredPorts})`);
  } else {
    failed++; // NUKE ran but root access denied
    ns.tprint(`FAIL: ${s} (NUKE ran but root not granted; requiredPorts=${requiredPorts})`);
  }
  // nuke throws an error if ports are not opened
} catch (e) {
  failed++; // count this as failure
  // try to extract most useful message from error objects
  const raw =
    e?.message ??       // use error's message property if it exists
    e?.toString?.() ??  // otherwise call toString() if it exists on the erorr
    stinrg (e);         // force the error into a string
  // cleanup the message so I don't just see "RUNETIME ERROR"
  const msg = raw
  .split("\n")          // break the error into individual text lines
  .map(l => l.trim())   // remove leading or trailing whitespace from each line
  .find(l => l && l !== "RUNTIME ERROR") ?? raw;  // find the first useful line that is not empty and is not a generic wrapper

  ns.tprint(`FAIL: ${s} (requiredPorts=${requiredPorts}) reason: ${msg}`);
  }
}

// print a summary after script runs and loop copmletes
ns.tprint(`Done. NUKED=${nuked}, alreadyRooted=${already}, failed=${failed}`);
}

// scanWithinHops() perform a scan of the network up to N hops and return an array of unique server hosts
function scanWithinHops(ns, start, maxHops) {
  // keep track of servers already discovered using a Set - prevents duplicates & infinite loops
  const seen = new Set([start]);
  // "frontier" holds the servers at the current hop distance
  let frontier = [start];
  // repeat once for each hop out
  for (let hop = 0; hop < maxHops; hop++) {
    // store servers discovered at next hop distance
    const next = [];
    // loop over all server in the current frontier
    for (const node of frontier) {
      // scan the directly connected neighbor of this server
      for (const neighbor of ns.scan(node)) {
        // if not seen before...
        if (!seen.has(neighbor)) {
          // mark as discovered
          seen.add(neighbor);
          // add to the next frontier to expand from it
          next.push(neighbor);
        }
      }
    }
    // Move one hop out
    frontier = next;
    // if no new server were found then stop early
    if (frontier.length === 0) break;
  }
  //convert the set of servers into an array and return it-
  return [...seen];
}
