// Vercel 서버리스 함수: 공공데이터포털(odcloud) 호출을 대신해 주어 키를 브라우저에 노출하지 않습니다.
// Vercel 환경변수 ODCLOUD_SERVICE_KEY 에 공공데이터포털 인증키를 등록하세요.
const BASE = 'https://api.odcloud.kr/api/15125100/v1/uddi:32a1b877-af20-4505-a76a-fd389dbd30ca'

export default async function handler(req, res) {
  let key = process.env.ODCLOUD_SERVICE_KEY
  if (!key) {
    res.status(500).json({ error: 'ODCLOUD_SERVICE_KEY is not set' })
    return
  }
  if (key.includes('%')) {
    try { key = decodeURIComponent(key) } catch { /* 그대로 사용 */ }
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const perPage = Math.min(500, Math.max(1, parseInt(req.query.perPage, 10) || 100))

  const url = new URL(BASE)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key)

  try {
    const upstream = await fetch(url)
    const body = await upstream.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(upstream.status).send(body)
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
}
