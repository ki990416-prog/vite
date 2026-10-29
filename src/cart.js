import { supabase } from './supabase.js'
import { searchImages, pixabayReady } from './pixabay.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const won = (n) => `${n.toLocaleString('ko-KR')}원`

let ctx = { getSession: () => null, openAuth: () => {} }
let products = []
let items = []
const imgCache = new Map()

async function productImage(q) {
  if (!pixabayReady || !q) return ''
  if (!imgCache.has(q)) {
    imgCache.set(q, searchImages(q, 3).then((r) => r[0]?.thumb || '').catch(() => ''))
  }
  return imgCache.get(q)
}

async function loadProducts() {
  const box = $('products')
  if (!supabase) { box.innerHTML = '<p class="msg">Supabase 환경변수가 설정되지 않았습니다.</p>'; return }
  const { data, error } = await supabase.from('products').select('*').order('id')
  if (error) { box.innerHTML = `<p class="msg">상품을 불러오지 못했습니다: ${esc(error.message)}</p>`; return }
  products = data
  if (!products.length) { box.innerHTML = '<p class="msg">등록된 상품이 없습니다.</p>'; return }
  box.innerHTML = ''
  for (const p of products) {
    const el = document.createElement('div')
    el.className = 'product'
    el.innerHTML = `
      <div class="thumb"></div>
      <h3>${esc(p.name)}</h3>
      <p class="desc">${esc(p.description || '')}</p>
      <div class="buy"><strong>${won(p.price)}</strong><button class="btn small">담기</button></div>`
    el.querySelector('button').onclick = () => addToCart(p.id)
    box.append(el)
    productImage(p.image_query).then((src) => {
      if (src) el.querySelector('.thumb').style.backgroundImage = `url("${src}")`
    })
  }
}

async function loadCart() {
  if (!supabase || !ctx.getSession()) { items = []; renderCart(); return }
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, quantity, product_id, products(id, name, price, image_query)')
    .order('created_at')
  if (error) { $('cart-msg').textContent = error.message; return }
  items = data
  renderCart()
}

async function addToCart(productId) {
  if (!ctx.getSession()) { ctx.openAuth('signin'); return }
  const existing = items.find((i) => i.product_id === productId)
  const { error } = existing
    ? await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
    : await supabase.from('cart_items').insert({ product_id: productId, quantity: 1 })
  if (error) { alert(error.message); return }
  await loadCart()
  $('cart-dialog').showModal()
}

async function changeQty(item, delta) {
  const q = item.quantity + delta
  const { error } = q < 1
    ? await supabase.from('cart_items').delete().eq('id', item.id)
    : await supabase.from('cart_items').update({ quantity: q }).eq('id', item.id)
  if (error) { $('cart-msg').textContent = error.message; return }
  await loadCart()
}

async function removeItem(item) {
  const { error } = await supabase.from('cart_items').delete().eq('id', item.id)
  if (error) { $('cart-msg').textContent = error.message; return }
  await loadCart()
}

async function clearCart() {
  const { error } = await supabase.from('cart_items').delete().in('id', items.map((i) => i.id))
  if (error) { $('cart-msg').textContent = error.message; return }
  await loadCart()
}

function renderCart() {
  const count = items.reduce((s, i) => s + i.quantity, 0)
  const total = items.reduce((s, i) => s + i.quantity * i.products.price, 0)
  $('cart-count').textContent = String(count)
  $('cart-total').textContent = won(total)
  $('cart-msg').textContent = ''
  $('cart-clear').disabled = !items.length
  const list = $('cart-list')
  if (!items.length) { list.innerHTML = '<p class="msg">장바구니가 비어 있습니다.</p>'; return }
  list.innerHTML = ''
  for (const it of items) {
    const row = document.createElement('div')
    row.className = 'cart-row'
    row.innerHTML = `
      <div class="cart-name">${esc(it.products.name)}<small>${won(it.products.price)}</small></div>
      <div class="qty"><button aria-label="감소">−</button><span>${it.quantity}</span><button aria-label="증가">+</button></div>
      <div class="cart-sub">${won(it.products.price * it.quantity)}</div>
      <button class="x" aria-label="삭제">×</button>`
    const [minus, plus] = row.querySelectorAll('.qty button')
    minus.onclick = () => changeQty(it, -1)
    plus.onclick = () => changeQty(it, 1)
    row.querySelector('.x').onclick = () => removeItem(it)
    list.append(row)
  }
}

export function initCart(opts) {
  ctx = opts
  $('cart-btn').onclick = () => {
    if (!ctx.getSession()) { ctx.openAuth('signin'); return }
    $('cart-dialog').showModal()
  }
  $('cart-close').onclick = () => $('cart-dialog').close()
  $('cart-clear').onclick = clearCart
  loadProducts()
  loadCart()
}

export const refreshCart = loadCart
