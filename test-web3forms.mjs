// Standalone test for Web3Forms API
// Run: node test-web3forms.mjs

const OLD_KEY = '6ff77564-e32e-4034-95ee-57830e7c2fb7';
const NEW_KEY = '619ecb95-9c90-415e-94fd-94a6d9ee8adb';

async function testKey(label, accessKey) {
  console.log(`\n=== Testing: ${label} (${accessKey.slice(0,8)}...) ===`);
  
  // Test 1: JSON
  console.log('\n-- Test 1: JSON (application/json) --');
  try {
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        Type: 'Bug',
        Name: 'Test Script',
        Message: 'This is a test from a standalone script.'
      })
    });
    const text = await r.text();
    console.log(`Status: ${r.status}`);
    console.log(`Response: ${text}`);
    try {
      const json = JSON.parse(text);
      if (json.success) console.log('✅ JSON test SUCCESS');
      else console.log('❌ JSON test FAILED:', json.message);
    } catch { console.log('⚠️ Response was not JSON'); }
  } catch (err) {
    console.log('❌ Network error:', err.message);
  }

  // Test 2: FormData (multipart/form-data)
  console.log('\n-- Test 2: FormData (multipart/form-data) --');
  try {
    const fd = new FormData();
    fd.append('access_key', accessKey);
    fd.append('Type', 'Bug');
    fd.append('Name', 'Test Script');
    fd.append('Message', 'This is a test from a standalone script.');
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: fd
    });
    const text = await r.text();
    console.log(`Status: ${r.status}`);
    console.log(`Response: ${text}`);
    try {
      const json = JSON.parse(text);
      if (json.success) console.log('✅ FormData test SUCCESS');
      else console.log('❌ FormData test FAILED:', json.message);
    } catch { console.log('⚠️ Response was not JSON'); }
  } catch (err) {
    console.log('❌ Network error:', err.message);
  }
}

async function main() {
  console.log('Web3Forms API Test');
  console.log('==================');
  console.log(`Time: ${new Date().toISOString()}`);
  
  await testKey('OLD key (from journey.html)', OLD_KEY);
  await testKey('NEW key (your replacement)', NEW_KEY);
  
  console.log('\n==================');
  console.log('Test complete.');
}

main();
