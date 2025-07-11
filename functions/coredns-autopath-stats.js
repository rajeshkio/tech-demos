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
      // Get current DNS resolution stats
      const doc = await db.collection('globalStats').doc('dns-resolutions').get();
      const data = doc.data() || { 
        totalResolutions: 0, 
        resolutionsToday: 0, 
        lastResolution: null 
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (event.httpMethod === 'POST') {
      // Increment DNS resolution count
      const statsRef = db.collection('globalStats').doc('dns-resolutions');
      
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(statsRef);
        
        if (!doc.exists) {
          transaction.set(statsRef, {
            totalResolutions: 1,
            resolutionsToday: 1,
            lastResolution: admin.firestore.FieldValue.serverTimestamp(),
            lastDayReset: new Date().toDateString()
          });
        } else {
          const data = doc.data();
          const today = new Date().toDateString();
          const resolutionsToday = data.lastDayReset === today ? data.resolutionsToday + 1 : 1;
          
          transaction.update(statsRef, {
            totalResolutions: admin.firestore.FieldValue.increment(1),
            resolutionsToday: resolutionsToday,
            lastResolution: admin.firestore.FieldValue.serverTimestamp(),
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
