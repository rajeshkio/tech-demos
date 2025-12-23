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
      // Get current hard links demo stats
      const doc = await db.collection('globalStats').doc('hardlinks-demos').get();
      const data = doc.data() || { 
        totalDemos: 0, 
        demosToday: 0, 
        lastDemo: null 
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (event.httpMethod === 'POST') {
      // Increment hard links demo count
      const statsRef = db.collection('globalStats').doc('hardlinks-demos');
      
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(statsRef);
        
        if (!doc.exists) {
          transaction.set(statsRef, {
            totalDemos: 1,
            demosToday: 1,
            lastDemo: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: new Date().toDateString()
          });
        } else {
          const data = doc.data();
          const now = new Date();
          const today = now.toISOString().split('T')[0]; 
          const lastReset = data.lastDayReset || '';
          const demosToday = lastReset === today ? data.demosToday + 1 : 1;
          
          transaction.update(statsRef, {
            totalDemos: admin.firestore.FieldValue.increment(1),
            demosToday: demosToday,
            lastDemo: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: today
          });
        }
      });

      const updated = await statsRef.get();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updated.data())
      };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
