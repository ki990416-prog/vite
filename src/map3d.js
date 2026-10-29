import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// 1 unit = 1 km. x: 동(+), z: 남(+). 지형 높이만 EXAG 배 과장.
const KM_LON = 92.9
const KM_LAT = 111
const EXAG = 2.2
const SEA = -0.05
const PHI = 0.2
const A = 37
const B = 15.5

const toXZ = (lon, lat) => [(lon - 126.55) * KM_LON, -(lat - 33.38) * KM_LAT]
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const hash2 = (ix, iz) => { const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return s - Math.floor(s) }
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 지형 ----------
function islandR(x, z) {
  const u = x * Math.cos(PHI) - z * Math.sin(PHI)
  const v = x * Math.sin(PHI) + z * Math.cos(PHI)
  const th = Math.atan2(v / B, u / A)
  const R = 1 + 0.05 * Math.sin(2 * th + 0.7) + 0.035 * Math.sin(5 * th + 1.3) + 0.02 * Math.sin(9 * th)
  return Math.hypot(u / A, v / B) / R
}
const [HX, HZ] = toXZ(126.533, 33.362)

// [이름, 경도, 위도, 높이(km), 폭σ(km), 설명]
const NAMED_OREUMS = [
  ['새별오름', 126.358, 33.364, 0.22, 0.9, '해발 519m. 매년 들불축제가 열리는 서부의 대표 오름입니다.'],
  ['금오름', 126.300, 33.352, 0.20, 0.7, '정상 분화구에 물이 고이는 호수(금오름 호수)가 있는 오름입니다.'],
  ['용눈이오름', 126.806, 33.460, 0.18, 0.8, '부드러운 능선이 아름다운 동부의 대표 오름입니다.'],
  ['다랑쉬오름', 126.805, 33.482, 0.25, 0.8, "깊은 굼부리를 가져 '오름의 여왕'이라 불립니다."],
  ['거문오름', 126.717, 33.449, 0.20, 0.9, '세계자연유산 제주 화산섬과 용암동굴계의 분화구입니다.'],
  ['산굼부리', 126.686, 33.431, 0.15, 0.7, '천연기념물로 지정된 거대한 분화구입니다.'],
  ['군산오름', 126.327, 33.246, 0.22, 0.6, '서귀포 안덕 일대를 조망하는 쌍봉 오름입니다.'],
]
const BUMPS = [
  // 산방산, 성산일출봉은 바다에 면한 급경사 봉우리
  { x: toXZ(126.314, 33.239)[0], z: toXZ(126.314, 33.239)[1], amp: 0.3, s: 0.55 },
  { x: toXZ(126.939, 33.458)[0], z: toXZ(126.939, 33.458)[1], amp: 0.18, s: 0.45 },
]
for (const o of NAMED_OREUMS) { const [x, z] = toXZ(o[1], o[2]); BUMPS.push({ x, z, amp: o[3], s: o[4] }) }
{
  const rnd = mulberry(20240)
  let n = 0
  while (n < 110) {
    const x = (rnd() - 0.5) * 70, z = (rnd() - 0.5) * 30
    if (islandR(x, z) > 0.82 || Math.hypot(x - HX, z - HZ) < 5) continue
    BUMPS.push({ x, z, amp: 0.05 + rnd() * 0.14, s: 0.35 + rnd() * 0.45 })
    n++
  }
}
// 부속 섬 [경도, 위도, 반경σ, 높이]
const ISLETS = [
  [126.953, 33.502, 1.8, 0.14], // 우도
  [126.269, 33.115, 0.7, 0.14], // 마라도
  [126.272, 33.168, 0.8, 0.15], // 가파도
  [126.234, 33.420, 0.5, 0.2],  // 비양도
  [126.152, 33.312, 0.6, 0.2],  // 차귀도
].map(([lon, lat, s, amp]) => { const [x, z] = toXZ(lon, lat); return { x, z, s, amp } })

function elevation(x, z) {
  const r = islandR(x, z)
  let e
  if (r < 1) {
    const t = 1 - r
    const dh = Math.hypot(x - HX, z - HZ)
    let base = 0.8 * Math.pow(t, 1.3) + 1.2 * Math.pow(Math.max(0, 1 - dh / 10), 1.7)
    base -= 0.12 * Math.exp(-((dh / 0.5) ** 2)) // 백록담
    const sm = smooth(0, 0.06, t)
    e = base * sm + SEA * (1 - sm)
  } else {
    e = SEA - 0.15 * Math.min(1, (r - 1) * 8)
  }
  for (const b of BUMPS) {
    const d2 = (x - b.x) ** 2 + (z - b.z) ** 2
    if (d2 < 9 * b.s * b.s) e += b.amp * Math.exp(-d2 / (b.s * b.s))
  }
  for (const b of ISLETS) {
    const d2 = (x - b.x) ** 2 + (z - b.z) ** 2
    if (d2 < 9 * b.s * b.s) e += b.amp * Math.exp(-d2 / (b.s * b.s))
  }
  return e
}
const groundY = (x, z) => Math.max(elevation(x, z), 0) * EXAG
function clampLand(x, z, maxR) {
  const r = islandR(x, z)
  return r > maxR ? [x * maxR / r, z * maxR / r] : [x, z]
}

const rgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace)
const C = {
  deep: rgb(0.05, 0.22, 0.34), shallow: rgb(0.13, 0.45, 0.55), sand: rgb(0.86, 0.78, 0.58),
  g1: rgb(0.36, 0.56, 0.26), g2: rgb(0.45, 0.62, 0.3), field: rgb(0.68, 0.70, 0.30), soil: rgb(0.56, 0.46, 0.26),
  forest: rgb(0.14, 0.33, 0.18), scrub: rgb(0.36, 0.42, 0.26), rock: rgb(0.45, 0.42, 0.38), peak: rgb(0.7, 0.68, 0.64),
}
function terrainColor(x, z, e, out) {
  if (e < -0.03) return out.copy(C.deep).lerp(C.shallow, smooth(-0.2, -0.03, e))
  if (e < 0.012) return out.copy(C.shallow).lerp(C.sand, smooth(-0.03, 0, e))
  const n = hash2(Math.floor(x * 2.5), Math.floor(z * 2.5))
  const m = hash2(Math.floor(x * 10), Math.floor(z * 10))
  out.copy(C.g1).lerp(C.g2, m)
  if (z > 1.5 && e < 0.55) {
    if (n < 0.4) out.copy(C.field).lerp(C.g2, m * 0.4)
    else if (n < 0.52) out.copy(C.soil)
  }
  out.lerp(C.sand, 1 - smooth(0.012, 0.06, e))
  out.lerp(C.forest, smooth(0.5, 0.85, e))
  out.lerp(C.scrub, smooth(1.0, 1.3, e))
  out.lerp(C.rock, smooth(1.3, 1.7, e))
  out.lerp(C.peak, smooth(1.78, 1.95, e))
  return out
}

// ---------- 데이터 ----------
const LAYERS = [
  { key: 'tour', name: '관광지', color: '#e8505b' },
  { key: 'oreum', name: '오름', color: '#3f9142' },
  { key: 'olle', name: '올레길', color: '#8e44ad' },
  { key: 'port', name: '항·포구', color: '#1976d2' },
  { key: 'tangerine', name: '감귤 재배지', color: '#f08a24' },
  { key: 'lighthouse', name: '등대', color: '#d4a20a' },
  { key: 'wind', name: '풍력발전기', color: '#607d8b' },
  { key: 'hareubang', name: '돌하르방', color: '#795548' },
  { key: 'api', name: '공공데이터', color: '#6d4fd8' },
]
// islet: 좌표 보정 없이 그대로 배치 / free: 해안선 보정 없음
const POIS = [
  { layer: 'tour', name: '한라산 백록담', lon: 126.533, lat: 33.362, desc: '해발 1,947m, 남한 최고봉. 정상에는 화구호 백록담이 있습니다.', free: true },
  { layer: 'tour', name: '성산일출봉', lon: 126.939, lat: 33.458, desc: '바다에서 솟은 수성화산체로, 세계자연유산이자 일출 명소입니다.', free: true },
  { layer: 'tour', name: '만장굴', lon: 126.771, lat: 33.528, desc: '세계 최장급 용암동굴 가운데 하나로 천연기념물입니다.', free: true },
  { layer: 'tour', name: '천지연폭포', lon: 126.555, lat: 33.247, desc: '서귀포 시내에 있는 22m 높이의 폭포입니다.', free: true },
  { layer: 'tour', name: '협재해변', lon: 126.240, lat: 33.394, desc: '에메랄드빛 바다와 비양도가 보이는 서부의 대표 해변입니다.', free: true },
  { layer: 'tour', name: '산방산', lon: 126.314, lat: 33.239, desc: '해안에 솟은 종 모양의 용암돔(해발 395m)입니다.', free: true },
  { layer: 'tour', name: '섭지코지', lon: 126.931, lat: 33.424, desc: '성산 인근의 해안 절경과 등대가 어우러진 곶입니다.', free: true },
  { layer: 'tour', name: '우도', lon: 126.953, lat: 33.502, desc: '소가 누운 모양의 섬. 땅콩과 산호해변으로 유명합니다.', free: true },
  { layer: 'tour', name: '주상절리대', lon: 126.425, lat: 33.238, desc: '용암이 식으며 만든 육각 기둥 절벽입니다.', free: true },
  { layer: 'tour', name: '비자림', lon: 126.806, lat: 33.489, desc: '수백 년 된 비자나무가 군락을 이룬 숲입니다.', free: true },
  { layer: 'tour', name: '용두암', lon: 126.511, lat: 33.516, desc: '용이 머리를 쳐든 듯한 해안 바위입니다.', free: true },
  { layer: 'tour', name: '마라도', lon: 126.269, lat: 33.115, desc: '국토 최남단의 섬입니다.', free: true },
  { layer: 'tour', name: '카멜리아힐', lon: 126.370, lat: 33.290, desc: '동백나무 수목원입니다.', free: true },
  { layer: 'port', name: '제주항', lon: 126.545, lat: 33.523, desc: '제주의 관문 항구로, 육지를 잇는 여객선이 오갑니다.' },
  { layer: 'port', name: '애월항', lon: 126.317, lat: 33.467, desc: '애월 해안도로 인근의 항구입니다.' },
  { layer: 'port', name: '한림항', lon: 126.262, lat: 33.414, desc: '비양도 도항선이 출발하는 서부 항구입니다.' },
  { layer: 'port', name: '성산포항', lon: 126.929, lat: 33.469, desc: '우도 도항선이 출발하는 항구입니다.' },
  { layer: 'port', name: '서귀포항', lon: 126.563, lat: 33.238, desc: '새섬과 이어지는 남부의 대표 항구입니다.' },
  { layer: 'port', name: '모슬포항', lon: 126.252, lat: 33.213, desc: '마라도·가파도행 배가 출발합니다.' },
  { layer: 'port', name: '화순항', lon: 126.351, lat: 33.236, desc: '남서부의 항구입니다.' },
  { layer: 'lighthouse', name: '도두등대', lon: 126.462, lat: 33.513, desc: '제주공항 인근 도두봉 해안의 등대입니다.' },
  { layer: 'lighthouse', name: '산지등대', lon: 126.540, lat: 33.526, desc: '제주항 입구를 밝히는 등대입니다.' },
  { layer: 'lighthouse', name: '마라도등대', lon: 126.268, lat: 33.115, desc: '국토 최남단을 밝히는 등대입니다.', free: true },
  { layer: 'lighthouse', name: '우도등대', lon: 126.956, lat: 33.503, desc: '우도 정상에 있는 등대입니다.', free: true },
  { layer: 'hareubang', name: '돌하르방 (제주시)', lon: 126.530, lat: 33.505, desc: '제주의 상징인 현무암 석상. 마을을 지키는 수호신입니다.' },
  { layer: 'hareubang', name: '돌하르방 (서귀포)', lon: 126.560, lat: 33.255, desc: '벙거지 모자와 큰 눈, 두 손을 배에 모은 모습이 특징입니다.' },
  { layer: 'hareubang', name: '돌하르방 (성산)', lon: 126.925, lat: 33.452, desc: '성산 일대를 지키는 돌하르방입니다.' },
  { layer: 'hareubang', name: '돌하르방 (한림)', lon: 126.300, lat: 33.400, desc: '서부 마을의 돌하르방입니다.' },
  { layer: 'tangerine', name: '효돈·위미 감귤밭', lon: 126.640, lat: 33.285, desc: '서귀포 동부 남쪽 사면의 대표 감귤 재배지입니다. (모형 표현)' },
  { layer: 'tangerine', name: '남원 감귤밭', lon: 126.720, lat: 33.290, desc: '따뜻한 남쪽 해안 사면의 감귤 과수원입니다. (모형 표현)' },
  { layer: 'tangerine', name: '서귀포 서홍 감귤밭', lon: 126.520, lat: 33.275, desc: '서귀포 시내 위쪽의 감귤 과수원입니다. (모형 표현)' },
  { layer: 'tangerine', name: '안덕 감귤밭', lon: 126.340, lat: 33.280, desc: '서남부 감귤 과수원 지대입니다. (모형 표현)' },
]
for (const o of NAMED_OREUMS) POIS.push({ layer: 'oreum', name: o[0], lon: o[1], lat: o[2], desc: o[5], free: true })

// 올레길: 대략적 경로(경도, 위도 순)
const OLLE = [
  { name: '올레 1코스 (시흥~광치기)', desc: '말미오름과 성산일출봉을 지나는 동쪽 코스. (대략적 경로)', pts: [[126.905, 33.440], [126.93, 33.45], [126.945, 33.465], [126.93, 33.485], [126.90, 33.50]] },
  { name: '올레 7코스 (외돌개~월평)', desc: '서귀포 해안 절경을 따라 걷는 코스. (대략적 경로)', pts: [[126.53, 33.243], [126.56, 33.244], [126.585, 33.252], [126.62, 33.255], [126.65, 33.26]] },
  { name: '올레 10코스 (화순~모슬포)', desc: '산방산과 송악산을 지나는 서남부 코스. (대략적 경로)', pts: [[126.36, 33.235], [126.33, 33.228], [126.29, 33.208], [126.25, 33.208]] },
  { name: '올레 17코스 (광령~제주원도심)', desc: '제주 원도심으로 이어지는 북부 코스. (대략적 경로)', pts: [[126.44, 33.46], [126.47, 33.49], [126.50, 33.515], [126.53, 33.522]] },
]
const TURBINES = [
  { name: '행원 풍력단지', desc: '제주 북동부 해안의 풍력발전단지입니다. (형상 확대 표현)', a: [126.77, 33.552], b: [126.85, 33.545], n: 6 },
  { name: '한경 해상풍력', desc: '제주 서부 바다의 해상풍력단지입니다. (형상 확대 표현)', a: [126.17, 33.355], b: [126.16, 33.32], n: 6 },
  { name: '가시리 풍력단지', desc: '중산간 초원 지대의 풍력발전기입니다. (형상 확대 표현)', a: [126.76, 33.36], b: [126.80, 33.37], n: 4 },
]

// ---------- 3D 모델 ----------
function makeTurbine() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.6 })
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 0.5, 8), white)
  tower.position.y = 0.25
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), white)
  nacelle.position.set(0, 0.5, 0)
  const rotor = new THREE.Group()
  rotor.position.set(0, 0.5, 0.045)
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group()
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.26, 0.004), white)
    blade.position.y = 0.13
    arm.add(blade)
    arm.rotation.z = (i * Math.PI * 2) / 3
    rotor.add(arm)
  }
  g.add(tower, nacelle, rotor)
  g.userData.rotor = rotor
  return g
}
function makeLighthouse() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  const red = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 })
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.3, 12), white)
  tower.position.y = 0.15
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }))
  lamp.position.y = 0.335
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.07, 12), red)
  roof.position.y = 0.405
  const beam = new THREE.Group()
  beam.position.y = 0.335
  const coneGeo = new THREE.ConeGeometry(0.14, 1.4, 14, 1, true)
  coneGeo.rotateZ(-Math.PI / 2)
  coneGeo.translate(0.7, 0, 0)
  beam.add(new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xffe680, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })))
  g.add(tower, lamp, roof, beam)
  g.userData.beam = beam
  return g
}
function makeHareubang() {
  const g = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: 0x5c5a58, roughness: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 1 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.17, 12), stone)
  body.position.y = 0.085
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), stone)
  head.scale.y = 1.1
  head.position.y = 0.24
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.088, 0.055, 14), stone)
  hat.position.y = 0.31
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), stone)
  nose.position.set(0, 0.235, 0.075)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), dark)
  eyeL.position.set(-0.03, 0.265, 0.068)
  const eyeR = eyeL.clone(); eyeR.position.x = 0.03
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), stone)
  armL.rotation.z = Math.PI / 2; armL.position.set(-0.03, 0.12, 0.075)
  const armR = armL.clone(); armR.position.x = 0.03
  g.add(body, head, hat, nose, eyeL, eyeR, armL, armR)
  g.scale.setScalar(1.8)
  return g
}
function makeOrchard(cx, cz, rnd) {
  const geo = new THREE.SphereGeometry(0.05, 8, 6)
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), 120)
  const m = new THREE.Matrix4(), col = new THREE.Color()
  let n = 0
  for (let i = -6; i < 6 && n < 120; i++) {
    for (let j = -5; j < 5 && n < 120; j++) {
      const x = cx + i * 0.11, z = cz + j * 0.11
      const e = elevation(x, z)
      if (e < 0.02) continue
      m.makeTranslation(x, e * EXAG + 0.03, z)
      mesh.setMatrixAt(n, m)
      mesh.setColorAt(n, col.set(rnd() < 0.28 ? 0xf08a24 : 0x2f6b2a))
      n++
    }
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

function labelSprite(text, color) {
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')
  const font = '600 26px "Noto Sans KR","Malgun Gothic",sans-serif'
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 34
  cv.width = w; cv.height = 48
  ctx.font = font
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(1, 1, w - 2, 46, 23)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText(text, w / 2, 25)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: false, depthTest: false }))
  const h = 0.034
  sp.scale.set((h * w) / 48, h, 1)
  sp.renderOrder = 10
  return sp
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }

export function initMap(host) {
  host.classList.add('map3d')
  const bar = el('div', 'map-bar')
  const stage = el('div', 'map-stage')
  const info = el('aside', 'map-info'); info.hidden = true
  const hint = el('div', 'map-hint', '※ 지형 높이 2.2배 과장 · 구조물은 식별을 위해 확대 · 올레길은 대략적 경로')
  host.append(bar, stage)

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    stage.append(el('p', 'msg', '이 브라우저에서는 WebGL을 사용할 수 없습니다.'))
    return
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  stage.append(renderer.domElement, info, hint)

  const scene = new THREE.Scene()
  const SKY = new THREE.Color(0xa8d4ee)
  scene.background = SKY
  scene.fog = new THREE.Fog(SKY, 90, 260)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1200)
  const HOME = { pos: new THREE.Vector3(0, 46, 64), tgt: new THREE.Vector3(0, 0.5, 0) }
  camera.position.copy(HOME.pos)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(HOME.tgt)
  controls.enableDamping = true
  controls.minDistance = 1.5
  controls.maxDistance = 170
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.autoRotateSpeed = 0.6

  scene.add(new THREE.HemisphereLight(0xdcefff, 0x55603f, 1.2))
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3)
  sun.position.set(-45, 55, 40)
  scene.add(sun)

  // 지형
  const geo = new THREE.PlaneGeometry(96, 72, 300, 225)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const e = elevation(x, z)
    pos.setY(i, e * EXAG)
    terrainColor(x, z, e, tmp)
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })))

  // 바다
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b7fb8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.78 })
  const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 100, 90, 70).rotateX(-Math.PI / 2), waterMat)
  scene.add(water)
  const farSea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a86b5 }))
  farSea.position.y = -0.05
  scene.add(farSea)
  const wp = water.geometry.attributes.position
  const wBase = Float32Array.from(wp.array)

  // 구름
  const clouds = []
  {
    const rnd = mulberry(7)
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false })
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group()
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1.5 + rnd() * 1.5, 10, 8), cm)
        s.position.set((rnd() - 0.5) * 5, (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 3)
        s.scale.y = 0.4
        g.add(s)
      }
      g.position.set((rnd() - 0.5) * 90, 7 + rnd() * 3, (rnd() - 0.5) * 50)
      scene.add(g)
      clouds.push(g)
    }
  }

  // 레이어
  const groups = {}
  const spinners = { rotors: [], beams: [] }
  const clickables = []
  for (const L of LAYERS) { groups[L.key] = new THREE.Group(); scene.add(groups[L.key]) }
  const colorOf = (key) => LAYERS.find((l) => l.key === key).color
  const addMarker = (layer, name, x, y, z, desc, extra = {}) => {
    const lift = 0.9
    const sp = labelSprite(name, colorOf(layer))
    sp.position.set(x, y + lift, z)
    sp.userData = { poi: { layer, name, desc, x, y, z, ...extra }, baseScale: sp.scale.clone() }
    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + lift, z)]),
      new THREE.LineBasicMaterial({ color: colorOf(layer) }),
    )
    groups[layer].add(stem, sp)
    clickables.push(sp)
    return sp
  }

  const rnd = mulberry(99)
  for (const p of POIS) {
    let [x, z] = toXZ(p.lon, p.lat)
    if (!p.free) [x, z] = clampLand(x, z, 0.985)
    const y = groundY(x, z)
    addMarker(p.layer, p.name, x, y, z, p.desc, { lon: p.lon, lat: p.lat })
    if (p.layer === 'lighthouse') {
      const m = makeLighthouse()
      m.position.set(x, y, z)
      m.scale.setScalar(1.4)
      groups.lighthouse.add(m)
      spinners.beams.push(m.userData.beam)
    } else if (p.layer === 'hareubang') {
      const m = makeHareubang()
      m.position.set(x, y, z)
      m.rotation.y = rnd() * Math.PI * 2
      groups.hareubang.add(m)
    } else if (p.layer === 'tangerine') {
      groups.tangerine.add(makeOrchard(x, z, rnd))
    }
  }
  for (const T of TURBINES) {
    const [ax, az] = toXZ(...T.a), [bx, bz] = toXZ(...T.b)
    for (let i = 0; i < T.n; i++) {
      const t = T.n === 1 ? 0 : i / (T.n - 1)
      const [x, z] = clampLand(ax + (bx - ax) * t, az + (bz - az) * t, 1.03)
      const m = makeTurbine()
      m.position.set(x, groundY(x, z), z)
      m.rotation.y = 0.6
      m.scale.setScalar(1.6)
      m.userData.rotor.rotation.z = rnd() * 6
      groups.wind.add(m)
      spinners.rotors.push(m.userData.rotor)
    }
    const [mx, mz] = clampLand((ax + bx) / 2, (az + bz) / 2, 1.03)
    addMarker('wind', T.name, mx, groundY(mx, mz) + 0.5, mz, T.desc)
  }
  for (const O of OLLE) {
    const pts2 = O.pts.map(([lon, lat]) => { const [x, z] = toXZ(lon, lat); return clampLand(x, z, 0.95) })
    const curve = new THREE.CatmullRomCurve3(pts2.map(([x, z]) => new THREE.Vector3(x, 0, z)))
    const pts3 = curve.getPoints(100).map((v) => new THREE.Vector3(v.x, groundY(v.x, v.z) + 0.06, v.z))
    const path = new THREE.CatmullRomCurve3(pts3)
    groups.olle.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.07, 6, false), new THREE.MeshBasicMaterial({ color: 0x9b3fd4 })))
    const s = pts3[Math.floor(pts3.length / 2)]
    addMarker('olle', O.name, s.x, s.y, s.z, O.desc)
  }

  // 공공데이터포털(odcloud) 데이터: /api/odcloud 서버리스 함수를 통해 불러온다.
  // 위도·경도 항목이 있는 행만 제주 범위 안에서 지도에 표시한다.
  ;(async () => {
    const note = (t) => { hint.textContent = `${hint.textContent.split(' | ')[0]} | ${t}` }
    try {
      const res = await fetch('/api/odcloud?perPage=200')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rows = (await res.json()).data
      if (!Array.isArray(rows) || !rows.length) { note('공공데이터: 데이터 없음'); return }
      const keys = Object.keys(rows[0])
      const latK = keys.find((k) => /위도|lat/i.test(k))
      const lngK = keys.find((k) => /경도|lng|lon/i.test(k))
      const nameK = keys.find((k) => /명칭|명$|name|title/i.test(k)) || keys.find((k) => typeof rows[0][k] === 'string')
      if (!latK || !lngK) { note(`공공데이터 ${rows.length}건 수신, 좌표 항목이 없어 표시 불가`); return }
      let n = 0
      for (const r of rows) {
        const lat = parseFloat(r[latK]), lon = parseFloat(r[lngK])
        if (!(lat > 33.0 && lat < 33.7 && lon > 126.0 && lon < 127.1)) continue
        const [x, z] = toXZ(lon, lat)
        const desc = keys.filter((k) => k !== latK && k !== lngK && k !== nameK).slice(0, 4)
          .map((k) => `${k}: ${r[k]}`).join(' / ') || '공공데이터포털 제공 정보'
        addMarker('api', String(r[nameK] ?? '공공데이터'), x, groundY(x, z), z, desc, { lon, lat })
        n++
      }
      note(`공공데이터 ${n}건 표시`)
    } catch (e) {
      note('공공데이터 API 미연결')
    }
  })()

  // UI
  const chips = {}
  for (const L of LAYERS) {
    const b = el('button', 'tab active', L.name)
    b.style.setProperty('--chip', L.color)
    b.onclick = () => {
      const on = !groups[L.key].visible
      groups[L.key].visible = on
      b.classList.toggle('active', on)
      if (!on && selected?.layer === L.key) closeInfo()
    }
    chips[L.key] = b
    bar.append(b)
  }
  const resetBtn = el('button', 'tab ghost', '전체 보기')
  const rotateBtn = el('button', 'tab ghost', '자동 회전')
  bar.append(resetBtn, rotateBtn)

  let selected = null
  function closeInfo() { info.hidden = true; selected = null }
  function showInfo(p) {
    selected = p
    info.innerHTML = ''
    const close = el('button', 'close', '×')
    close.onclick = closeInfo
    const tag = el('span', 'tag', LAYERS.find((l) => l.key === p.layer).name)
    tag.style.background = colorOf(p.layer)
    info.append(close, tag, el('h4', '', p.name), el('p', '', p.desc))
    if (p.lon) info.append(el('small', '', `경도 ${p.lon.toFixed(3)} · 위도 ${p.lat.toFixed(3)}`))
    info.hidden = false
  }

  let fly = null
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  function flyTo(pos, tgt) { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt, k: 0 } }
  controls.addEventListener('start', () => { fly = null })
  resetBtn.onclick = () => { closeInfo(); flyTo(HOME.pos.clone(), HOME.tgt.clone()) }
  rotateBtn.onclick = () => { controls.autoRotate = !controls.autoRotate; rotateBtn.classList.toggle('active', controls.autoRotate) }

  // 선택
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const live = clickables.filter((s) => s.parent.visible)
    return ray.intersectObjects(live, false)[0]?.object
  }
  let down = null
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
    const hit = pick(e)
    if (!hit) return
    const p = hit.userData.poi
    showInfo(p)
    const t = new THREE.Vector3(p.x, p.y, p.z)
    flyTo(t.clone().add(new THREE.Vector3(0, 5.5, 8.5)), t)
  })
  let hover = null
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons) return
    const h = pick(e) || null
    if (h === hover) return
    if (hover) hover.scale.copy(hover.userData.baseScale)
    hover = h
    if (h) h.scale.copy(h.userData.baseScale).multiplyScalar(1.25)
    renderer.domElement.style.cursor = h ? 'pointer' : ''
  })

  // 크기·가시성
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(stage)
  resize()
  let visible = true
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting) }).observe(stage)

  const clock = new THREE.Clock()
  function frame() {
    requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.1)
    if (!visible) return
    const t = clock.elapsedTime
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / 1.4)
      const k = ease(fly.k)
      camera.position.lerpVectors(fly.p0, fly.p1, k)
      controls.target.lerpVectors(fly.t0, fly.t1, k)
      if (fly.k >= 1) fly = null
    }
    for (const r of spinners.rotors) r.rotation.z += dt * 1.6
    for (const b of spinners.beams) b.rotation.y += dt * 1.4
    for (const c of clouds) { c.position.x += dt * 0.5; if (c.position.x > 55) c.position.x = -55 }
    for (let i = 0; i < wp.count; i++) {
      const x = wBase[i * 3], z = wBase[i * 3 + 2]
      wp.setY(i, Math.sin(x * 0.5 + t * 1.2) * 0.012 + Math.cos(z * 0.6 + t) * 0.01)
    }
    wp.needsUpdate = true
    controls.update()
    renderer.render(scene, camera)
  }
  frame()
  return { scene, camera, controls }
}
