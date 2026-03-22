const fs = require("fs");
const path = require("path");

// Read version from package.json
const packageJson = require("./package.json");
const version = packageJson.version;

// --------- Android: update build.gradle ---------
const gradlePath = path.join(__dirname, "android", "app", "build.gradle");
let gradleContent = fs.readFileSync(gradlePath, "utf8");

// Replace versionCode and versionName
const versionCode = version.replace(/\D/g, "") || "1"; // fallback to 1
gradleContent = gradleContent
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

fs.writeFileSync(gradlePath, gradleContent);
console.log("✅ Android version synced");

// Load the capacitor config (TS or JSON - adjust as needed)
const capconfig = require("./ionic.config.json");

// Extract appName and appId
const appName = capconfig.name || "MyApp";
const appId = capconfig.appid || "com.example.app";

// Path to strings.xml
const stringsXmlPath = path.join(
  __dirname,
  "android",
  "app",
  "src",
  "main",
  "res",
  "values",
  "strings.xml"
);

// Read the current strings.xml
let xml = fs.readFileSync(stringsXmlPath, "utf8");

// Replace values
xml = xml
  .replace(
    /<string name="app_name">.*?<\/string>/,
    `<string name="app_name">${appName}</string>`
  )
  .replace(
    /<string name="title_activity_main">.*?<\/string>/,
    `<string name="title_activity_main">${appName}</string>`
  )
  .replace(
    /<string name="package_name">.*?<\/string>/,
    `<string name="package_name">${appId}</string>`
  )
  .replace(
    /<string name="custom_url_scheme">.*?<\/string>/,
    `<string name="custom_url_scheme">${appId}</string>`
  );

// Write back to file
fs.writeFileSync(stringsXmlPath, xml, "utf8");

console.log("✅ Android strings.xml updated with appName and appId.");

// --------- iOS: update Info.plist ---------
const plistPath = path.join(__dirname, "ios", "App", "App", "Info.plist");
if (fs.existsSync(plistPath)) {
  let plistContent = fs.readFileSync(plistPath, "utf8");
  plistContent = plistContent
    .replace(
      /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleShortVersionString</key>\n\t<string>${version}</string>`
    )
    .replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleVersion</key>\n\t<string>${version}</string>`
    );

  fs.writeFileSync(plistPath, plistContent);
  console.log("✅ iOS version synced");
} else {
  console.warn("⚠️  iOS Info.plist not found");
}
