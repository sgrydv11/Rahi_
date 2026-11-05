const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const root = dirname(require.resolve('react-native-razorpay/package.json'));
const gradle = join(root, 'android', 'build.gradle');
const manifest = join(root, 'android', 'src', 'main', 'AndroidManifest.xml');

// Razorpay 2.3.1 predates the Android Gradle Plugin's required library namespace.
const original = readFileSync(gradle, 'utf8');
if (!original.includes("namespace 'com.razorpay.rn'")) {
  const updated = original.replace(/^android \{/m, "android {\n    namespace 'com.razorpay.rn'");
  if (updated === original) throw new Error('Unexpected Razorpay Android Gradle configuration.');
  writeFileSync(gradle, updated);
}
const xml = readFileSync(manifest, 'utf8');
const updatedXml = xml.replace(/\s+package="com\.razorpay\.rn"/, '');
if (updatedXml !== xml) writeFileSync(manifest, updatedXml);
