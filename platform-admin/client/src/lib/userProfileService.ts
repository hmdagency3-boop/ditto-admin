export interface UserProfileData {
  name: string;
  image: string;
  vipId: number | null;
  vipName: string | null;
  /** Days remaining on the VIP subscription, as returned by vipInfoDto.vipDate on the Ditto profile search page. */
  vipDaysLeft: number | null;
}

const profileCache = new Map<string, Promise<UserProfileData | null>>();

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/**
 * Fetches name/image/VIP info the same way the Ditto profile search page does:
 * resolve the erban-style ID to a Ditto uid, then read /api/ditto/user/:uid/profile
 * (vipLevel/vipName/vipInfoDto.vipDate). Falls back to the legacy payermax getInfo
 * proxy for name/image if the identifier isn't a resolvable Ditto erban number.
 */
export async function fetchUserProfile(identifier: string | null | undefined): Promise<UserProfileData | null> {
  if (!identifier) return null;

  const cached = profileCache.get(identifier);
  if (cached) return cached;

  const promise = fetchUserProfileUncached(identifier);
  profileCache.set(identifier, promise);
  return promise;
}

async function fetchUserProfileUncached(identifier: string): Promise<UserProfileData | null> {
  try {
    let uid: string | null = null;
    if (/^\d+$/.test(identifier)) {
      const lookupRes = await fetch(`/api/ditto/lookup/erban/${encodeURIComponent(identifier)}`, { headers: authHeaders() });
      if (lookupRes.ok) {
        const lookupJson = await lookupRes.json();
        if (lookupJson.ok && lookupJson.uid) uid = String(lookupJson.uid);
      }
    }

    if (uid) {
      const profileRes = await fetch(`/api/ditto/user/${encodeURIComponent(uid)}/profile`, { headers: authHeaders() });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.ok) {
          return {
            name: profile.nickname || '',
            image: profile.avatar || '',
            vipId: profile.vipLevel != null && Number.isFinite(Number(profile.vipLevel)) ? Number(profile.vipLevel) : null,
            vipName: profile.vipName || null,
            vipDaysLeft: profile.vipInfoDto?.vipDate != null && Number.isFinite(Number(profile.vipInfoDto.vipDate))
              ? Number(profile.vipInfoDto.vipDate)
              : null,
          };
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Ditto profile:', error);
  }

  // Fallback: legacy proxy, name/image only (no reliable VIP duration here).
  try {
    const response = await fetch(`/api/platform-profile/${encodeURIComponent(identifier)}`, { headers: authHeaders() });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.code === 200 && result.data) {
      return {
        name: result.data.nick || result.data.name || result.data.full_name || '',
        image: result.data.avatar || result.data.image || result.data.picture || '',
        vipId: result.data.vipId != null && Number.isFinite(Number(result.data.vipId)) ? Number(result.data.vipId) : null,
        vipName: null,
        vipDaysLeft: null,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
