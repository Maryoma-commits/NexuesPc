// Admin configuration for NexusPC
// Only users with UIDs in this list can access admin dashboard

export const ADMIN_UIDS = [
  '6S4vRBMUVHf3GAvzKW6ShjYnxsV2', // Your account
  // Add more admin UIDs here in the future
];

export const isAdmin = (uid: string | null | undefined): boolean => {
  if (!uid) return false;
  return ADMIN_UIDS.includes(uid);
};
