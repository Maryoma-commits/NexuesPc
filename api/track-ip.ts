// Vercel Serverless Function - Track User IP on Authentication
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, action } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get IP address from request headers
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim() 
      : req.socket.remoteAddress || 'unknown';

    // Get user agent and other metadata
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = Date.now();

    // Return IP data to client (client will store in Firebase)
    return res.status(200).json({
      success: true,
      data: {
        ip,
        userAgent,
        timestamp,
        action: action || 'auth'
      }
    });

  } catch (error: any) {
    console.error('IP tracking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
