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
  // CORS headers for GitHub Pages
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Get current stats
      const doc = await db.collection('globalStats').doc('deployments').get();
      const data = doc.data() || { totalDeployments: 0, deploymentsToday: 0, lastDeployment: null };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (event.httpMethod === 'POST') {
      // Increment deployment count
      const statsRef = db.collection('globalStats').doc('deployments');
      
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(statsRef);
        
        if (!doc.exists) {
          // Create document if it doesn't exist
          transaction.set(statsRef, {
            totalDeployments: 1,
            deploymentsToday: 1,
            lastDeployment: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: new Date().toDateString()
          });
        } else {
          // Check if we need to reset daily counter
          const data = doc.data();
          const today = new Date().toDateString();
          const deploymentsToday = data.lastDayReset === today ? data.deploymentsToday + 1 : 1;
          
          transaction.update(statsRef, {
            totalDeployments: admin.firestore.FieldValue.increment(1),
            deploymentsToday: deploymentsToday,
            lastDeployment: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: today
          });
        }
      });

      // Return updated stats
      const updated = await statsRef.get();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updated.data())
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
