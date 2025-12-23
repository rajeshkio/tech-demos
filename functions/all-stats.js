const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET',
    'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Fetch all stats in parallel from Firebase
    const [
      bootSims,
      dnsResolutions,
      pkiLab,
      deployments,
      portforward,
      masquerade,
      goConcurrency,
      hardlinks
    ] = await Promise.all([
      db.collection('globalStats').doc('boot-simulations').get(),
      db.collection('globalStats').doc('dns-resolutions').get(),
      db.collection('globalStats').doc('pki-lab-tests').get(),
      db.collection('globalStats').doc('deployments').get(),
      db.collection('globalStats').doc('portforward-demos').get(),
      db.collection('globalStats').doc('masquerade-simulations').get(),
      db.collection('globalStats').doc('go-concurrency-steps').get(),
      db.collection('globalStats').doc('hardlinks-demos').get()
    ]);

    const response = {
      'linux-boot-process': bootSims.data() || { totalBoots: 0 },
      'coredns-autopath': dnsResolutions.data() || { totalResolutions: 0 },
      'pki-infra': pkiLab.data() || { totalTests: 0 },
      'self-provisioning-proxmox': deployments.data() || { totalDeployments: 0 },
      'kubectl-portforward': portforward.data() || { totalDemos: 0 },
      'nat-masquerade': masquerade.data() || { totalSimulations: 0 },
      'go-concurrency': goConcurrency.data() || { totalSteps: 0 },
      'linux-hard-links': hardlinks.data() || { totalDemos: 0 }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('All Stats Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
