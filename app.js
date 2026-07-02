/* ═══════════════════════════════════════════
   ORGANICO GOLD — E-Commerce App
   Módulos: Config · Sanitize · Product · Cart · Checkout · UI · Stock
   ═══════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════
   CONFIG (único lugar para cambiar datos)
══════════════════════════════════════════ */
const CONFIG = Object.freeze({
  WA_NUMBER:  '573000000000',           // ← cambia a tu número real
  WA_MSG:     'Hola! Quiero pedir café Organico Gold ☕',
  FREE_SHIP:  80000,                    // monto mínimo envío gratis Bogotá
  SHIP_COSTS: { bogota: 8000, other: 14000, free: 0 },
  STOCK_INIT: 47,
  STORAGE_KEY:'og_cart_v2',
  IMAGES: [
    'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&q=80',
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
  ],
  PRICE_MAP: {
    '250g': { price:35000, original:43000 },
    '500g': { price:65000, original:80000 },
    '1kg':  { price:120000, original:148000 },
  },
});

/* ══════════════════════════════════════════
   SANITIZE — previene XSS en salidas HTML
══════════════════════════════════════════ */
const Sanitize = {
  text(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#x27;')
      .slice(0, 500);
  },
  // Para mensajes de WhatsApp: solo encode URI
  wa(str) {
    return encodeURIComponent(String(str).slice(0,300));
  },
};

/* ══════════════════════════════════════════
   PRODUCT STATE
══════════════════════════════════════════ */
const Product = (() => {
  let state = { grind:'Molido Espresso', size:'500g', qty:1 };

  function currentPrice()    { return CONFIG.PRICE_MAP[state.size].price; }
  function currentOriginal() { return CONFIG.PRICE_MAP[state.size].original; }
  function currentDiscount() {
    const pct = Math.round((1 - currentPrice()/currentOriginal())*100);
    return `-${pct}%`;
  }

  function selectGrind(btn, value) {
    state.grind = value;
    _deactivate('grindOptions', btn);
    const nameEl = document.getElementById('productName');
    if (nameEl) nameEl.textContent = `Organico Gold – ${Sanitize.text(value)}`;
  }

  function selectSize(btn, size, _price) {
    state.size = size;
    _deactivate('sizeOptions', btn);
    _renderPrice();
  }

  function selectView(btn, idx) {
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const img = document.getElementById('productPhoto');
    if (img && CONFIG.IMAGES[idx]) {
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = CONFIG.IMAGES[idx];
        img.style.opacity = '1';
      }, 200);
      img.style.transition = 'opacity .2s ease';
    }
  }

  function changeQty(delta) {
    state.qty = Math.min(Math.max(1, state.qty + delta), 20);
    const el = document.getElementById('qtyDisplay');
    if (el) el.textContent = state.qty;
  }

  function _deactivate(groupId, activeBtn) {
    document.querySelectorAll(`#${groupId} .option-btn`).forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  function _renderPrice() {
    const cur = document.getElementById('priceDisplay');
    const ori = document.getElementById('priceOriginal');
    const dis = document.getElementById('priceDiscount');
    if (cur) cur.textContent = `$${currentPrice().toLocaleString('es-CO')} COP`;
    if (ori) ori.textContent = `$${currentOriginal().toLocaleString('es-CO')}`;
    if (dis) dis.textContent = currentDiscount();
  }

  function snapshot() {
    return {
      id: `${state.grind}__${state.size}`.replace(/\s+/g,'_'),
      name: 'Organico Gold',
      detail: `${state.grind} · ${state.size}`,
      price: currentPrice(),
      qty: state.qty,
      imgSrc: CONFIG.IMAGES[0],
    };
  }

  return { selectGrind, selectSize, selectView, changeQty, snapshot };
})();

/* ══════════════════════════════════════════
   CART
══════════════════════════════════════════ */
const Cart = (() => {
  let items = _load();

  function _load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function _save() {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(items)); }
    catch { /* quota exceeded — silent */ }
  }

  function add() {
    const item = Product.snapshot();
    if (item.qty < 1 || item.qty > 20) return;

    const existing = items.find(i => i.id === item.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + item.qty, 20);
    } else {
      items.push(item);
    }
    _save();
    _render();
    UI.toast(`☕ ${Sanitize.text(item.detail)} agregado al carrito`);
    toggle();
  }

  function addSubscription() {
    items.push({
      id: 'suscripcion_mensual',
      name: 'Suscripción Mensual',
      detail: 'Café 500g – Entrega mensual · 15% OFF',
      price: Math.round(CONFIG.PRICE_MAP['500g'].price * 0.85),
      qty: 1,
      imgSrc: CONFIG.IMAGES[0],
    });
    _save();
    _render();
    UI.toast('✅ Suscripción agregada – 15% de descuento aplicado');
    Checkout.open();
  }

  function remove(id) {
    items = items.filter(i => i.id !== id);
    _save();
    _render();
  }

  function clear() {
    items = [];
    _save();
    _render();
  }

  function total()  { return items.reduce((s,i) => s + i.price * i.qty, 0); }
  function count()  { return items.reduce((s,i) => s + i.qty, 0); }
  function getAll() { return [...items]; }
  function isEmpty(){ return items.length === 0; }

  function _render() {
    const countEl  = document.getElementById('cartCount');
    const itemsEl  = document.getElementById('cartItems');
    const emptyEl  = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    const totalEl  = document.getElementById('cartTotal');
    if (!itemsEl) return;

    if (countEl) countEl.textContent = count();

    if (isEmpty()) {
      emptyEl && (emptyEl.style.display = '');
      if (footerEl) footerEl.hidden = true;
      itemsEl.innerHTML = '';
      itemsEl.appendChild(emptyEl);
      return;
    }

    emptyEl && (emptyEl.style.display = 'none');
    if (footerEl) footerEl.hidden = false;
    if (totalEl) totalEl.textContent = `$${total().toLocaleString('es-CO')} COP`;

    itemsEl.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="cart-item-img">
          <img src="${item.imgSrc}" alt="${Sanitize.text(item.name)}" loading="lazy" />
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${Sanitize.text(item.name)}</div>
          <div class="cart-item-sub">${Sanitize.text(item.detail)} ×${item.qty}</div>
        </div>
        <div class="cart-item-price">$${(item.price * item.qty).toLocaleString('es-CO')}</div>
        <button class="cart-item-remove" data-id="${Sanitize.text(item.id)}" aria-label="Eliminar">✕</button>
      `;
      itemsEl.appendChild(row);
    });

    // Delegación de eventos para botones eliminar
    itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => remove(btn.dataset.id));
    });
  }

  function toggle() {
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('active');
    overlay?.classList.toggle('active', !isOpen);
    sidebar.classList.toggle('active', !isOpen);
    sidebar.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  // Inicializar render
  _render();

  return { add, addSubscription, remove, clear, total, count, getAll, isEmpty, toggle };
})();

/* ══════════════════════════════════════════
   CHECKOUT
══════════════════════════════════════════ */
const Checkout = (() => {
  let shippingCost = 0;

  function open() {
    if (Cart.isEmpty()) {
      UI.toast('⚠️ Agrega un producto antes de continuar');
      return;
    }
    // Cerrar carrito si está abierto
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar?.classList.contains('active')) Cart.toggle();

    _fillSummary();
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  }

  function close() {
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.hidden = true; document.body.style.overflow = ''; }
  }

  function closeSuccess() {
    const modal = document.getElementById('successModal');
    if (modal) { modal.hidden = true; document.body.style.overflow = ''; }
  }

  function updateShipping() {
    const city = document.getElementById('city')?.value;
    const sub  = Cart.total();

    if (!city) {
      shippingCost = 0;
      const el = document.getElementById('summaryShipping');
      if (el) el.textContent = 'Selecciona ciudad';
      return;
    }

    if (city === 'bogota' && sub >= CONFIG.FREE_SHIP) {
      shippingCost = CONFIG.SHIP_COSTS.free;
      _setShipEl('¡GRATIS! 🎉');
    } else if (city === 'bogota') {
      shippingCost = CONFIG.SHIP_COSTS.bogota;
      _setShipEl(`$${shippingCost.toLocaleString('es-CO')} COP`);
    } else {
      shippingCost = CONFIG.SHIP_COSTS.other;
      _setShipEl(`$${shippingCost.toLocaleString('es-CO')} COP`);
    }

    // Recargo contraentrega
    const pm = document.querySelector('input[name="payment"]:checked');
    if (pm?.value === 'contraentrega') shippingCost += 5000;

    _setTotalEl();
  }

  function _setShipEl(text) {
    const el = document.getElementById('summaryShipping');
    if (el) el.textContent = text;
  }

  function _setTotalEl() {
    const el = document.getElementById('summaryTotal');
    if (el) el.textContent = `$${(Cart.total() + shippingCost).toLocaleString('es-CO')} COP`;
  }

  function _fillSummary() {
    const container = document.getElementById('orderSummaryItems');
    const subEl     = document.getElementById('summarySubtotal');
    if (!container) return;
    container.innerHTML = '';

    Cart.getAll().forEach(item => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `
        <span>${Sanitize.text(item.name)} – ${Sanitize.text(item.detail)} ×${item.qty}</span>
        <span>$${(item.price * item.qty).toLocaleString('es-CO')}</span>
      `;
      container.appendChild(row);
    });

    if (subEl) subEl.textContent = `$${Cart.total().toLocaleString('es-CO')}`;
    _setShipEl('Selecciona tu ciudad');
    _setTotalEl();
  }

  function _validate() {
    const fields = [
      { id:'fullName', min:3,  msg:'Ingresa tu nombre completo (mínimo 3 caracteres)' },
      { id:'phone',    reg:/^[\+\d\s\-]{7,15}$/, msg:'Ingresa un teléfono válido' },
      { id:'email',    reg:/^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg:'Ingresa un correo válido' },
      { id:'city',     required:true, msg:'Selecciona tu ciudad' },
      { id:'address',  min:10, msg:'Ingresa tu dirección completa' },
    ];
    let valid = true;
    fields.forEach(f => {
      const el    = document.getElementById(f.id);
      const errEl = document.getElementById(f.id + 'Error');
      if (!el) return;
      const val = el.value.trim();
      let msg = '';
      if (f.required && !val)         msg = f.msg;
      else if (f.min && val.length < f.min) msg = f.msg;
      else if (f.reg && !f.reg.test(val))   msg = f.msg;
      if (errEl) errEl.textContent = msg;
      if (msg) { valid = false; el.focus(); }
    });
    return valid;
  }

  function process(e) {
    e.preventDefault();
    if (!_validate()) return;

    const payBtn = document.getElementById('payBtn');
    if (payBtn) { payBtn.textContent = '⏳ Procesando...'; payBtn.disabled = true; }

    const name    = document.getElementById('fullName')?.value.trim() ?? '';
    const phone   = document.getElementById('phone')?.value.trim() ?? '';
    const email   = document.getElementById('email')?.value.trim() ?? '';
    const city    = document.getElementById('city')?.value ?? '';
    const address = document.getElementById('address')?.value.trim() ?? '';
    const notes   = document.getElementById('notes')?.value.trim() ?? '';
    const pm      = document.querySelector('input[name="payment"]:checked')?.value ?? 'nequi';

    const pmNames = { nequi:'Nequi', daviplata:'Daviplata', pse:'PSE', tarjeta:'Tarjeta', contraentrega:'Contraentrega' };
    const total   = Cart.total() + shippingCost;
    const lines   = Cart.getAll().map(i => `• ${i.name} ${i.detail} ×${i.qty} = $${(i.price * i.qty).toLocaleString('es-CO')}`).join('\n');

    const waText = [
      '¡Hola Organico Gold! ☕🫘',
      '',
      '*NUEVO PEDIDO*',
      `Nombre: ${name}`,
      `Teléfono: ${phone}`,
      `Email: ${email}`,
      `Ciudad: ${city}`,
      `Dirección: ${address}`,
      notes ? `Notas: ${notes}` : '',
      '',
      '*Productos:*',
      lines,
      '',
      `Envío: $${shippingCost.toLocaleString('es-CO')}`,
      `*TOTAL: $${total.toLocaleString('es-CO')} COP*`,
      '',
      `Forma de pago: ${pmNames[pm] ?? pm}`,
      '',
      '¡Espero las instrucciones de pago! 🙏',
    ].filter(l => l !== undefined).join('\n');

    setTimeout(() => {
      close();
      window.open(`https://wa.me/${CONFIG.WA_NUMBER}?text=${Sanitize.wa(waText)}`, '_blank', 'noopener,noreferrer');

      const successModal = document.getElementById('successModal');
      if (successModal) { successModal.hidden = false; document.body.style.overflow = 'hidden'; }

      Cart.clear();
      if (payBtn) { payBtn.textContent = '🔒 Confirmar y Pagar'; payBtn.disabled = false; }
      document.getElementById('checkoutForm')?.reset();
    }, 1800);
  }

  return { open, close, closeSuccess, updateShipping, process };
})();

/* ══════════════════════════════════════════
   UI — navegación, FAQ, scroll, etc.
══════════════════════════════════════════ */
const UI = (() => {
  let toastTimer;

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function toggleMenu() {
    const links = document.getElementById('navLinks');
    const ham   = document.getElementById('hamburger');
    const open  = links?.classList.toggle('open');
    ham?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleFaq(btn) {
    const item   = btn.closest('.faq-item');
    const answer = item?.querySelector('.faq-answer');
    const isOpen = item?.classList.contains('open');

    // Cerrar todos
    document.querySelectorAll('.faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-answer').hidden = true;
      i.querySelector('.faq-question').setAttribute('aria-expanded','false');
    });

    if (!isOpen && answer) {
      item.classList.add('open');
      answer.hidden = false;
      btn.setAttribute('aria-expanded','true');
    }
  }

  function _initNavScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
      navbar.style.boxShadow = window.scrollY > 50 ? '0 4px 20px rgba(0,0,0,.3)' : 'none';
    }, { passive:true });
  }

  function _initReveal() {
    const elements = document.querySelectorAll(
      '.why-card, .highlight-card, .testimonial-card, .process-step, .gallery-item, .origin-img-wrap, .origin-img-secondary-wrap'
    );
    elements.forEach((el, i) => {
      el.classList.add('reveal');
      if (i % 3 === 1) el.classList.add('reveal-delay-1');
      if (i % 3 === 2) el.classList.add('reveal-delay-2');
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold:0.12 });

    elements.forEach(el => observer.observe(el));
  }

  function _initCloseMenuOnLink() {
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.addEventListener('click', () => {
        document.getElementById('navLinks')?.classList.remove('open');
        document.getElementById('hamburger')?.setAttribute('aria-expanded','false');
      });
    });
  }

  function _initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const checkoutModal = document.getElementById('checkoutModal');
      const successModal  = document.getElementById('successModal');
      const sidebar       = document.getElementById('cartSidebar');
      if (!checkoutModal?.hidden)          Checkout.close();
      else if (!successModal?.hidden)      Checkout.closeSuccess();
      else if (sidebar?.classList.contains('active')) Cart.toggle();
    });
  }

  function init() {
    _initNavScroll();
    _initReveal();
    _initCloseMenuOnLink();
    _initKeyboard();
  }

  return { toast, toggleMenu, toggleFaq, init };
})();

/* ══════════════════════════════════════════
   STOCK COUNTDOWN
══════════════════════════════════════════ */
const Stock = (() => {
  let count = CONFIG.STOCK_INIT;

  function init() {
    const el = document.getElementById('stockCount');
    if (!el) return;
    setInterval(() => {
      if (Math.random() < 0.12 && count > 8) {
        count--;
        el.textContent = count;
        if (count < 15) el.style.color = '#FF6B5B';
      }
    }, 28000);
  }

  return { init };
})();

/* ══════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  UI.init();
  Stock.init();
});
