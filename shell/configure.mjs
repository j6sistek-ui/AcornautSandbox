// STAMP app.config.json INTO THE NATIVE PROJECTS. Idempotent: run it after
// every edit to app.config.json. It never needs Xcode or Android Studio, so
// it runs anywhere; the Mac is only needed to build and upload.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, "app.config.json"), "utf8"));
const unset = (v) => !v || String(v).startsWith("PLACEHOLDER");
const warn = [];

const appId = unset(cfg.appId) ? "com.placeholder.acornaut" : cfg.appId;
if (unset(cfg.appId)) warn.push("appId is a placeholder: the build uses com.placeholder.acornaut, which cannot be signed for a store");
const androidPkg = unset(cfg.android?.packageName) ? appId : cfg.android.packageName;
const version = cfg.marketingVersion || "1.0.0";
const build = Number(cfg.buildNumber || 1);
const read = (p) => readFileSync(p, "utf8");
const write = (p, s) => writeFileSync(p, s);
const setOrAdd = (src, key, value, after) => {
  const re = new RegExp(`^(\\s*)${key} = .*;$`, "gm");
  if (re.test(src)) return src.replace(re, `$1${key} = ${value};`);
  return src.replace(new RegExp(`^(\\s*)${after} = .*;$`, "gm"), (line, ws) => `${line}\n${ws}${key} = ${value};`);
};

// ---- capacitor.config.json
{
  const p = join(here, "capacitor.config.json");
  const c = JSON.parse(read(p));
  c.appId = appId; c.appName = cfg.appName || "Acornaut";
  write(p, JSON.stringify(c, null, 2) + "\n");
}

// ---- iOS
const ios = join(here, "ios", "App");
if (existsSync(ios)) {
  const app = join(ios, "App");
  // Swift sources the shell ships
  for (const f of ["BoardsPlugin.swift", "AcornautViewController.swift"]) copyFileSync(join(here, "native", "ios", f), join(app, f));
  // entitlements: Game Center
  write(join(app, "App.entitlements"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.game-center</key>
	<true/>
</dict>
</plist>
`);
  // the project file
  const pp = join(ios, "App.xcodeproj", "project.pbxproj");
  let x = read(pp);
  x = x.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);
  x = x.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  x = x.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
  x = x.replace(/TARGETED_DEVICE_FAMILY = [^;]+;/g, `TARGETED_DEVICE_FAMILY = 1;`);   // iPhone only for 1.0
  x = setOrAdd(x, "CODE_SIGN_ENTITLEMENTS", "App/App.entitlements", "CODE_SIGN_STYLE");
  if (!unset(cfg.ios?.teamId)) x = setOrAdd(x, "DEVELOPMENT_TEAM", cfg.ios.teamId, "CODE_SIGN_STYLE");
  else warn.push("ios.teamId is a placeholder: Xcode will ask you to pick the team under Signing & Capabilities");
  // the two Swift files, added to the App group and the Sources phase once
  for (const f of ["BoardsPlugin.swift", "AcornautViewController.swift"]) {
    if (x.includes(`/* ${f} */`)) continue;
    const id = (s) => createHash("md5").update(s).digest("hex").slice(0, 24).toUpperCase();
    const ref = id("ref:" + f), bf = id("build:" + f);
    x = x.replace(/(\t\t504EC3081FED79650016851F \/\* AppDelegate\.swift in Sources \*\/ = \{[^\n]*\n)/,
      `$1\t\t${bf} /* ${f} in Sources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${f} */; };\n`);
    x = x.replace(/(\t\t504EC3071FED79650016851F \/\* AppDelegate\.swift \*\/ = \{[^\n]*\n)/,
      `$1\t\t${ref} /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${f}; sourceTree = "<group>"; };\n`);
    x = x.replace(/(\t\t\t\t504EC3071FED79650016851F \/\* AppDelegate\.swift \*\/,\n)/, `$1\t\t\t\t${ref} /* ${f} */,\n`);
    x = x.replace(/(\t\t\t\t504EC3081FED79650016851F \/\* AppDelegate\.swift in Sources \*\/,\n)/, `$1\t\t\t\t${bf} /* ${f} in Sources */,\n`);
    if (!x.includes(`/* ${f} in Sources */,`)) warn.push(`could not add ${f} to the Xcode project: drag it into the App group in Xcode`);
  }
  write(pp, x);
  // Info.plist: portrait only
  const ip = join(app, "Info.plist");
  let plist = read(ip);
  plist = plist.replace(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>[\s\S]*?<\/array>/,
    `<key>UISupportedInterfaceOrientations</key>\n\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>`);
  plist = plist.replace(/<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>[\s\S]*?<\/array>/,
    `<key>UISupportedInterfaceOrientations~ipad</key>\n\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>`);
  if (!plist.includes("UIRequiresFullScreen")) plist = plist.replace("\t<key>UIViewControllerBasedStatusBarAppearance</key>", "\t<key>UIRequiresFullScreen</key>\n\t<true/>\n\t<key>UIViewControllerBasedStatusBarAppearance</key>");
  // ADS (13 Sep 2026): the AdMob app id the SDK reads at launch, and
  // Google's own SKAdNetwork id so iOS attributes installs from its ads
  const gad = cfg.admob?.iosAppId;
  if (gad) {
    plist = plist.includes("GADApplicationIdentifier")
      ? plist.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*/, `$1${gad}`)
      : plist.replace("\t<key>UIRequiresFullScreen</key>", `\t<key>GADApplicationIdentifier</key>\n\t<string>${gad}</string>\n\t<key>SKAdNetworkItems</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>\n\t<key>UIRequiresFullScreen</key>`);
    if (cfg.admob?.testing !== false) warn.push("admob.testing is true: the build shows Google's TEST ads");
  }
  write(ip, plist);
  // storyboard: our bridge controller
  const sb = join(app, "Base.lproj", "Main.storyboard");
  write(sb, read(sb).replace(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="AcornautViewController" customModule="App" customModuleProvider="target"'));
  // scene delegate: our bridge controller there too. The template throws the
  // storyboard's window away and roots its own in a stock
  // CAPBridgeViewController, so the storyboard patch alone shipped a bridge
  // with no BoardsPlugin and Game Center answered "not implemented" (audit,
  // 8 Sep 2026). Idempotent: after the first pass the old literal is gone.
  const sd = join(app, "SceneDelegate.swift");
  if (existsSync(sd)) write(sd, read(sd).replace("rootViewController = CAPBridgeViewController()", "rootViewController = AcornautViewController()"));
} else warn.push("ios/ missing: run `npx cap add ios`");

// ---- Android
const android = join(here, "android", "app");
if (existsSync(android)) {
  const bg = join(android, "build.gradle");
  let g = read(bg);
  g = g.replace(/namespace = "[^"]+"/, `namespace = "${androidPkg}"`);
  g = g.replace(/applicationId "[^"]+"/, `applicationId "${androidPkg}"`);
  g = g.replace(/versionCode \d+/, `versionCode ${build}`);
  g = g.replace(/versionName "[^"]+"/, `versionName "${version}"`);
  if (!g.includes("play-services-games-v2")) g = g.replace(/(\n    implementation project\(':capacitor-android'\))/, `$1\n    implementation "com.google.android.gms:play-services-games-v2:20.1.2"`);
  write(bg, g);
  // strings
  const sp = join(android, "src", "main", "res", "values", "strings.xml");
  let s = read(sp);
  s = s.replace(/<string name="app_name">[^<]*/, `<string name="app_name">${cfg.appName || "Acornaut"}`);
  s = s.replace(/<string name="title_activity_main">[^<]*/, `<string name="title_activity_main">${cfg.appName || "Acornaut"}`);
  s = s.replace(/<string name="package_name">[^<]*/, `<string name="package_name">${androidPkg}`);
  s = s.replace(/<string name="custom_url_scheme">[^<]*/, `<string name="custom_url_scheme">${androidPkg}`);
  const pg = unset(cfg.android?.playGamesProjectId) ? "0" : cfg.android.playGamesProjectId;
  if (unset(cfg.android?.playGamesProjectId)) warn.push("android.playGamesProjectId is a placeholder: Play Games leaderboards stay off on Android");
  s = s.includes("game_services_project_id")
    ? s.replace(/<string name="game_services_project_id">[^<]*/, `<string name="game_services_project_id">${pg}`)
    : s.replace("</resources>", `    <string name="game_services_project_id">${pg}</string>\n</resources>`);
  write(sp, s);
  // manifest: portrait, Play Games app id
  const mp = join(android, "src", "main", "AndroidManifest.xml");
  let mf = read(mp);
  if (!mf.includes('android:screenOrientation')) mf = mf.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="portrait"');
  if (!mf.includes("com.google.android.gms.games.APP_ID")) mf = mf.replace("        <provider", `        <meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id" />\n\n        <provider`);
  // ADS (13 Sep 2026): the AdMob app id the SDK reads at launch
  if (cfg.admob?.androidAppId) {
    mf = mf.includes("com.google.android.gms.ads.APPLICATION_ID")
      ? mf.replace(/(com\.google\.android\.gms\.ads\.APPLICATION_ID" android:value=")[^"]*/, `$1${cfg.admob.androidAppId}`)
      : mf.replace("        <provider", `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admob.androidAppId}" />\n\n        <provider`);
  }
  write(mp, mf);
  // the java package: move to the stamped package, rewrite package lines
  const javaRoot = join(android, "src", "main", "java");
  const want = join(javaRoot, ...androidPkg.split("."));
  const findMain = (dir) => { for (const f of readdirSync(dir, { withFileTypes: true })) { const q = join(dir, f.name); if (f.isDirectory()) { const r = findMain(q); if (r) return r; } else if (f.name === "MainActivity.java") return dir; } return null; };
  const cur = findMain(javaRoot);
  if (cur && cur !== want) { mkdirSync(dirname(want), { recursive: true }); renameSync(cur, want); let up = dirname(cur); while (up !== javaRoot && readdirSync(up).length === 0) { rmSync(up, { recursive: true }); up = dirname(up); } }
  write(join(want, "BoardsPlugin.java"), read(join(here, "native", "android", "BoardsPlugin.java")).replace("__PACKAGE__", androidPkg));
  const ma = join(want, "MainActivity.java");
  write(ma, `package ${androidPkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BoardsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
} else warn.push("android/ missing: run `npx cap add android`");

console.log(`configured: ${cfg.appName} · iOS ${appId} · Android ${androidPkg} · ${version} (${build})`);
for (const w of warn) console.log("  note: " + w);
