import './style.css'
import { supabase, supabaseReady } from './supabase.js'
import { searchImages, pixabayReady } from './pixabay.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// ---------- 갤러리 ----------
const TOPICS = [
  { label: '제주도', q: 'jeju island' },
  { label: '한라산', q: 'hallasan' },
  { label: '해변', q: 'jeju beach' },
  { label: '성산일출봉', q: 'seongsan ilchulbong' },
  { label: '감귤·유채', q: 'jeju tangerine canola' },
]
const GUEST_LIMIT = 6
const MEMBER_LIMIT = 24
let topic = TOPICS[0]
let session = null

function renderTabs() {
  $('tabs').innerHTML = ''
  TOPICS.forEach((t) => {
    const b = document.createElement('button')
    b.textContent = t.label
    b.className = t === topic ? 'tab active' : 'tab'
    b.onclick = () => { topic = t; renderTabs(); loadGallery() }
    $('tabs').append(b)
  })
}

async function loadGallery() {
  const grid = $('grid')
  if (!pixabayReady) {
    grid.innerHTML = '<p class="msg">VITE_PIXABAY_API_KEY가 설정되지 않아 사진을 불러올 수 없습니다.</p>'
    return
  }
  grid.innerHTML = '<p class="msg">불러오는 중…</p>'
  try {
    const limit = session ? MEMBER_LIMIT : GUEST_LIMIT
    const imgs = (await searchImages(topic.q, limit)).slice(0, limit)
    if (!imgs.length) { grid.innerHTML = '<p class="msg">사진이 없습니다.</p>'; return }
    grid.innerHTML = ''
    imgs.forEach((im) => {
      const a = document.createElement('a')
      a.href = im.page; a.target = '_blank'; a.rel = 'noopener'; a.className = 'card'
      a.innerHTML = `<img loading="lazy" src="${esc(im.thumb)}" alt="${esc(im.alt)}" /><span>by ${esc(im.user)}</span>`
      grid.append(a)
    })
    if (!session) {
      const cta = document.createElement('button')
      cta.className = 'card cta'
      cta.textContent = '로그인하면 더 많은 사진을 볼 수 있어요 →'
      cta.onclick = () => openAuth('signin')
      grid.append(cta)
    }
    $('hero-bg').style.backgroundImage = `url("${imgs[0].large}")`
  } catch (e) {
    grid.innerHTML = `<p class="msg">사진을 불러오지 못했습니다: ${esc(e.message)}</p>`
  }
}

// ---------- 인증 ----------
let mode = 'signin'
function openAuth(m) {
  mode = m
  syncAuthUi()
  $('auth-msg').textContent = supabaseReady ? '' : 'Supabase 환경변수가 설정되지 않았습니다.'
  $('auth-dialog').showModal()
}
function syncAuthUi() {
  const signin = mode === 'signin'
  $('auth-title').textContent = signin ? '로그인' : '회원가입'
  $('auth-submit').textContent = signin ? '로그인' : '가입하기'
  $('auth-toggle').textContent = signin ? '회원가입으로 전환' : '로그인으로 전환'
  $('auth-form').password.autocomplete = signin ? 'current-password' : 'new-password'
}
$('auth-toggle').onclick = () => { mode = mode === 'signin' ? 'signup' : 'signin'; syncAuthUi() }
$('auth-close').onclick = () => $('auth-dialog').close()

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!supabase) return
  const { email, password } = e.target
  const msg = $('auth-msg')
  msg.textContent = '처리 중…'
  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) { msg.textContent = error.message; return }
    if (data.session) { $('auth-dialog').close() }
    else msg.textContent = '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.'
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
    if (error) { msg.textContent = error.message; return }
    $('auth-dialog').close()
  }
})

function renderUser() {
  const area = $('user-area')
  area.innerHTML = ''
  if (session) {
    const span = document.createElement('span')
    span.className = 'who'; span.textContent = session.user.email
    const out = document.createElement('button')
    out.className = 'link'; out.textContent = '로그아웃'
    out.onclick = () => supabase.auth.signOut()
    area.append(span, out)
  } else {
    const a = document.createElement('button')
    a.className = 'link'; a.textContent = '로그인'; a.onclick = () => openAuth('signin')
    const b = document.createElement('button')
    b.className = 'btn small'; b.textContent = '회원가입'; b.onclick = () => openAuth('signup')
    area.append(a, b)
  }
  $('gallery-sub').textContent = session
    ? '회원님께는 더 많은 사진을 보여드립니다.'
    : `비회원은 ${GUEST_LIMIT}장까지 볼 수 있습니다.`
}

// ---------- 시작 ----------
renderTabs()
renderUser()
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    session = data.session; renderUser(); loadGallery()
  })
  supabase.auth.onAuthStateChange((_evt, s) => {
    const changed = Boolean(s) !== Boolean(session)
    session = s; renderUser()
    if (changed) loadGallery()
  })
} else {
  loadGallery()
}
