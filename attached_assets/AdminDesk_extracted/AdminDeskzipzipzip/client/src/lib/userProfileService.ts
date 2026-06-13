export interface UserProfileData {
  name: string;
  image: string;
}

export async function fetchUserProfile(identifier: string): Promise<UserProfileData | null> {
  try {
    const response = await fetch(
      `https://www.sayyouditto.com/pay/payermax/getInfo?no=${encodeURIComponent(identifier)}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch user profile:', response.statusText);
      return null;
    }

    const result = await response.json();
    
    // Extract name and image from response
    // API returns data inside result.data object
    if (result.code === 200 && result.data) {
      return {
        name: result.data.nick || result.data.name || result.data.full_name || '',
        image: result.data.avatar || result.data.image || result.data.picture || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}
