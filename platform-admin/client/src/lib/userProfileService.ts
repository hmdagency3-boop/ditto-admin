export interface UserProfileData {
  name: string;
  image: string;
  vipId: number | null;
  vipDate: number | string | null;
}

export async function fetchUserProfile(identifier: string | null | undefined): Promise<UserProfileData | null> {
  if (!identifier) return null;
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      `/api/platform-profile/${encodeURIComponent(identifier)}`,
      {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      }
    );

    if (!response.ok) return null;

    const result = await response.json();

    if (result.code === 200 && result.data) {
      return {
        name: result.data.nick || result.data.name || result.data.full_name || '',
        image: result.data.avatar || result.data.image || result.data.picture || '',
        vipId: result.data.vipId != null && Number.isFinite(Number(result.data.vipId)) ? Number(result.data.vipId) : null,
        vipDate: result.data.vipDate ?? null,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
