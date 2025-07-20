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
    'Access-Control-Allow-Methods': 'GET, POST'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Get current NAT masquerade simulation stats
      const doc = await db.collection('globalStats').doc('masquerade-simulations').get();
      const data = doc.data() || { 
        totalSimulations: 0, 
        simulationsToday: 0, 
        successfulPings: 0,
        failedPings: 0,
        masqueradeUsageCount: 0,
        lastSimulation: null 
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (event.httpMethod === 'POST') {
      // Increment NAT masquerade simulation count
      const requestBody = JSON.parse(event.body || '{}');
      const { success = true, withMasquerade = false } = requestBody;
      
      const statsRef = db.collection('globalStats').doc('masquerade-simulations');
      
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(statsRef);
        
        if (!doc.exists) {
          transaction.set(statsRef, {
            totalSimulations: 1,
            simulationsToday: 1,
            successfulPings: success ? 1 : 0,
            failedPings: success ? 0 : 1,
            masqueradeUsageCount: withMasquerade ? 1 : 0,
            lastSimulation: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: new Date().toDateString()
          });
        } else {
          const data = doc.data();
          const today = new Date().toDateString();
          const simulationsToday = data.lastDayReset === today ? data.simulationsToday + 1 : 1;
          
          const updates = {
            totalSimulations: admin.firestore.FieldValue.increment(1),
            simulationsToday: simulationsToday,
            lastSimulation: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: today
          };

          if (success) {
            updates.successfulPings = admin.firestore.FieldValue.increment(1);
          } else {
            updates.failedPings = admin.firestore.FieldValue.increment(1);
          }

          if (withMasquerade) {
            updates.masqueradeUsageCount = admin.firestore.FieldValue.increment(1);
          }
          
          transaction.update(statsRef, updates);
        }
      });

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
    console.error('Masquerade NAT stats function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
