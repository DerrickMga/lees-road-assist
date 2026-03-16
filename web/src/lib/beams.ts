/**
 * Pusher Beams initialisation for Lee's Express Courier web app.
 *
 * Call `initBeams(userId)` after login to start receiving push notifications.
 * The service-worker.js in /public/ is required.
 */

const BEAMS_INSTANCE_ID = "11f71819-94b7-4a5b-abe5-5a1245fde4bc";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

declare global {
  interface Window {
    PusherPushNotifications: {
      Client: new (config: { instanceId: string }) => PusherBeamsClient;
    };
  }
}

interface PusherBeamsClient {
  start(): Promise<PusherBeamsClient>;
  addDeviceInterest(interest: string): Promise<void>;
  removeDeviceInterest(interest: string): Promise<void>;
  setUserId(
    userId: string,
    tokenProvider: { headers: Record<string, string> }
  ): Promise<void>;
  stop(): Promise<void>;
}

let beamsClient: PusherBeamsClient | null = null;

export async function initBeams(userId?: number): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("PusherPushNotifications" in window)) {
    console.warn("Pusher Beams SDK not loaded");
    return;
  }

  try {
    beamsClient = new window.PusherPushNotifications.Client({
      instanceId: BEAMS_INSTANCE_ID,
    });

    await beamsClient.start();

    if (userId) {
      const token = localStorage.getItem("token");
      // Authenticate with user ID for targeted notifications
      await beamsClient.setUserId(`user-${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      // Guest interest
      await beamsClient.addDeviceInterest("global-alerts");
    }

    console.log("Pusher Beams registered");
  } catch (err) {
    console.error("Pusher Beams init error:", err);
  }
}

export async function stopBeams(): Promise<void> {
  if (beamsClient) {
    try {
      await beamsClient.stop();
      beamsClient = null;
    } catch {}
  }
}
