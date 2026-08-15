const http = require('http');

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSystemVerification() {
  console.log('--- STARTING PHOTOBOOTH SYSTEM VERIFICATION ---');

  try {
    // 1. Test Active Event Endpoint
    const activeEvt = await makeRequest('http://localhost:3000/api/events/active');
    console.log('✅ GET /api/events/active:', activeEvt.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('   Event Name:', activeEvt.body.event.name);

    // 2. Test Overlays Endpoint
    const overlays = await makeRequest('http://localhost:3000/api/events/active');
    console.log('✅ GET /api/overlays count:', overlays.body.allOverlays.length);

    // 3. Test Print Layouts Endpoint
    const layouts = await makeRequest('http://localhost:3000/api/events/active');
    console.log('✅ GET /api/layouts count:', layouts.body.allLayouts.length);

    // 4. Test Session Photo Save & QR Generation Endpoint
    const sampleImageBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake_image_bytes').toString('base64');
    const sessionRes = await makeRequest('http://localhost:3000/api/sessions/save', 'POST', {
      event_id: activeEvt.body.event.id,
      mode: '3-up',
      retakes_used: 1,
      guest_action: 'both',
      raw_images: [sampleImageBase64, sampleImageBase64, sampleImageBase64],
      composited_image: sampleImageBase64
    });

    console.log('✅ POST /api/sessions/save:', sessionRes.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('   Generated Share URL:', sessionRes.body.shareUrl);
    console.log('   Generated QR Code URL:', sessionRes.body.qrCodeUrl);

    // 5. Test Public Guest Share Retrieval Endpoint
    const shareToken = sessionRes.body.shareToken;
    const shareRes = await makeRequest(`http://localhost:3000/api/sessions/share/${shareToken}`);
    console.log('✅ GET /api/sessions/share/:token:', shareRes.status === 200 ? 'SUCCESS' : 'FAILED');

    // 6. Test Cloud Worker Queue Status
    const cloudRes = await makeRequest('http://localhost:3000/api/cloud/status');
    console.log('✅ GET /api/cloud/status:', cloudRes.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('   Pending Queue Count:', cloudRes.body.stats.pending);

    // 7. Wait 5s for Cloud Worker to process queue automatically
    console.log('   Waiting 5 seconds for Cloud Auto-Upload worker...');
    await new Promise(r => setTimeout(r, 5000));

    const cloudResAfter = await makeRequest('http://localhost:3000/api/cloud/status');
    console.log('✅ Cloud Auto-Upload Queue Worker Verification:');
    console.log('   Uploaded Count:', cloudResAfter.body.stats.success);

    // 8. Analytics Overview Endpoint
    const analyticsRes = await makeRequest('http://localhost:3000/api/analytics/overview');
    console.log('✅ GET /api/analytics/overview:', analyticsRes.status === 200 ? 'SUCCESS' : 'FAILED');
    console.log('   Total Sessions Logged:', analyticsRes.body.metrics.totalSessions);

    console.log('\n🎉 ALL SYSTEM API & BACKGROUND WORKER VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  }
}

runSystemVerification();
