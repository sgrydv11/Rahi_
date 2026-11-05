import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const iosInfoPlist = join('ios', 'App', 'App', 'Info.plist');
let plist;
try {
  plist = await readFile(iosInfoPlist, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') process.exit(0);
  throw error;
}

const apiUrl = new URL(process.env.VITE_API_BASE_URL);
const domains = new Set(['localhost', apiUrl.hostname]);
const existingDomains = plist.match(/<key>WKAppBoundDomains<\/key>\s*<array>([\s\S]*?)<\/array>/);
const domainList = [...domains].map(domain => `\t\t<string>${domain}</string>`).join('\n');
const domainSetting = `\t<key>WKAppBoundDomains</key>\n\t<array>\n${domainList}\n\t</array>`;
if (existingDomains) {
  plist = plist.replace(existingDomains[0], domainSetting);
} else {
  const closingDict = plist.lastIndexOf('</dict>');
  if (closingDict < 0) throw new Error(`Could not find the root dictionary in ${iosInfoPlist}.`);
  plist = `${plist.slice(0, closingDict)}${domainSetting}\n${plist.slice(closingDict)}`;
}
await writeFile(iosInfoPlist, plist);
