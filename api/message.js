const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    action, text, user, toUserId, fromUserId, 
    offer, answer, candidate, isVideo, logType, 
    isGuest, status, lastSeen 
  } = req.body;

  try {
    switch (action) {
      // 1. CHAT MESSAGES
      case 'send-message':
        await pusher.trigger("chat-channel", "new-message", { text, user });
        return res.status(200).json({ success: true });

      // 2, 8. CALL SIGNALING & RINGTONE
      case 'call-user':
        await pusher.trigger(`user-${toUserId}`, "incoming-call", {
          fromUserId,
          offer,
          isVideo
        });
        return res.status(200).json({ success: true });

      // WEBRTC ANSWERS & ICE CANDIDATES
      case 'answer-call':
        await pusher.trigger(`user-${toUserId}`, "call-answered", { answer });
        return res.status(200).json({ success: true });

      case 'ice-candidate':
        await pusher.trigger(`user-${toUserId}`, "ice-candidate", { candidate });
        return res.status(200).json({ success: true });

      // 6, 7. END CALL LOG & AUTO RETURN
      case 'end-call':
        await pusher.trigger(`user-${toUserId}`, "call-ended", {
          fromUserId,
          logType // "missed" o "ended"
        });
        return res.status(200).json({ success: true });

      // 4. FRIEND SYSTEM & GUEST CHECKS
      case 'friend-request':
        if (isGuest) {
          return res.status(403).json({ error: 'Guests cannot send friend requests.' });
        }
        await pusher.trigger(`user-${toUserId}`, "friend-request-received", { fromUserId });
        return res.status(200).json({ success: true });

      case 'unfriend':
        await pusher.trigger(`user-${toUserId}`, "friend-updated", { fromUserId, status: 'unfriended' });
        return res.status(200).json({ success: true });

      // 5. ONLINE / OFFLINE STATUS TRACKER
      case 'user-status':
        await pusher.trigger("chat-channel", "status-change", {
          userId: user,
          status, // "online" o "offline"
          lastSeen: lastSeen || Date.now()
        });
        return res.status(200).json({ success: true });

      default:
        if (text) {
          await pusher.trigger("chat-channel", "new-message", { text, user });
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
