const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

module.exports = async (req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Kukunin ng Frontend ang env keys
  if (req.method === 'GET' && req.query.action === 'config') {
    return res.status(200).json({
      key: process.env.PUSHER_KEY,
      cluster: process.env.PUSHER_CLUSTER
    });
  }

  // 2. POST: Pusher Authentication Handler para sa Private/Presence Channels
  if (req.method === 'POST' && req.query.action === 'auth') {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    const username = req.body.username || req.query.username;

    const presenceData = {
      user_id: username || "user_" + Math.random().toString(36).substr(2, 9),
      user_info: { name: username }
    };

    try {
      const authResponse = pusher.authorizeChannel(socketId, channel, presenceData);
      return res.status(200).json(authResponse);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    action, text, user, toUserId, fromUserId, 
    offer, answer, candidate, isVideo, logType, 
    isGuest 
  } = req.body;

  try {
    switch (action) {
      case 'send-message':
        await pusher.trigger("presence-chat", "new-message", { text, user });
        return res.status(200).json({ success: true });

      case 'call-user':
        await pusher.trigger(`private-user-${toUserId}`, "incoming-call", {
          fromUserId,
          offer,
          isVideo
        });
        return res.status(200).json({ success: true });

      case 'answer-call':
        await pusher.trigger(`private-user-${toUserId}`, "call-answered", { answer });
        return res.status(200).json({ success: true });

      case 'ice-candidate':
        await pusher.trigger(`private-user-${toUserId}`, "ice-candidate", { candidate });
        return res.status(200).json({ success: true });

      case 'end-call':
        await pusher.trigger(`private-user-${toUserId}`, "call-ended", {
          fromUserId,
          logType
        });
        return res.status(200).json({ success: true });

      case 'friend-request':
        if (isGuest) {
          return res.status(403).json({ error: 'Guests cannot send friend requests.' });
        }
        await pusher.trigger(`private-user-${toUserId}`, "friend-request-received", { fromUserId });
        return res.status(200).json({ success: true });

      case 'unfriend':
        await pusher.trigger(`private-user-${toUserId}`, "friend-updated", { fromUserId, status: 'unfriended' });
        return res.status(200).json({ success: true });

      default:
        if (text) {
          await pusher.trigger("presence-chat", "new-message", { text, user });
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
