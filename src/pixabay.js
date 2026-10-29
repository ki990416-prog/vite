const KEY = import.meta.env.VITE_PIXABAY_API_KEY

export const pixabayReady = Boolean(KEY)

export async function searchImages(query, perPage = 12) {
  if (!KEY) return []
  const params = new URLSearchParams({
    key: KEY,
    q: query,
    image_type: 'photo',
    orientation: 'horizontal',
    safesearch: 'true',
    per_page: String(Math.max(perPage, 3)),
  })
  const res = await fetch(`https://pixabay.com/api/?${params}`)
  if (!res.ok) throw new Error(`Pixabay ${res.status}`)
  const data = await res.json()
  return data.hits.map((h) => ({
    id: h.id,
    thumb: h.webformatURL,
    large: h.largeImageURL,
    alt: h.tags,
    user: h.user,
    page: h.pageURL,
  }))
}
