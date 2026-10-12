// Read-only Google Places proxy. Credentials stay on the server.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ available: false });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return res.status(200).json({ available: false });
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews,attributions',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return res.status(502).json({ available: false });
    const data = await response.json();
    return res.status(200).json({
      available: true,
      name: data.displayName?.text || '',
      rating: data.rating,
      count: data.userRatingCount,
      url: data.googleMapsUri,
      attributions: data.attributions || [],
      reviews: (data.reviews || []).slice(0, 5).map(review => ({
        author: review.authorAttribution?.displayName || 'Usuário do Google',
        authorUrl: review.authorAttribution?.uri,
        rating: review.rating,
        text: review.text?.text || review.originalText?.text || '',
        date: review.publishTime,
        url: review.googleMapsUri,
      })),
    });
  } catch {
    // Do not expose upstream responses or credentials in errors.
    return res.status(502).json({ available: false });
  }
};
