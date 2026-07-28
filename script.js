const API_URL = 'https://script.google.com/macros/s/AKfycbw7TClfH70-3HUpjq2L1RwqtDbB4KSjIrZDrLon4wj4xVvwWI1YOCCYykFT0drStAgCBA/exec'; // เปลี่ยนตรงนี้เป็น Web App URL ของคุณที่ได้จาก Google Apps Script

function callApi(action, payload = {}) {
  return fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: action, payload: payload }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).then(res => res.json()).then(res => {
    if (res.status === 'error') throw new Error(res.message);
    return res.data;
  });
}

const state = {
  orders: [],
  statuses: [],
  sources: [],
  view: 'list',
  sourceFilter: '',
  modalOpen: false
};

const THB = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

document.addEventListener('DOMContentLoaded', () => {
  bindUi();
  loadData();
  setInterval(() => { if (!state.modalOpen) loadData(); }, 15000);
});

function bindUi() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      document.getElementById('listView').style.display = state.view === 'list' ? 'flex' : 'none';
      document.getElementById('kanbanView').style.display = state.view === 'kanban' ? 'grid' : 'none';
      renderAll();
    });
  });

  document.getElementById('sourceFilter').addEventListener('change', e => {
    state.sourceFilter = e.target.value;
    renderAll();
  });

  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });

  document.getElementById('orderForm').addEventListener('submit', onSubmitForm);
  document.getElementById('deleteBtn').addEventListener('click', onDeleteClick);

  document.getElementById('f_price').addEventListener('input', updateFormTotal);
  document.getElementById('f_shipping').addEventListener('input', updateFormTotal);
}

function updateFormTotal() {
  const price = Number(document.getElementById('f_price').value) || 0;
  const shipping = Number(document.getElementById('f_shipping').value) || 0;
  document.getElementById('f_total').textContent = '฿' + THB.format(price + shipping);
}

/* ===== data load ===== */
function loadData() {
  if (API_URL === 'YOUR_WEB_APP_URL_HERE') {
    onError(new Error("กรุณาใส่ Web App URL ที่ไฟล์ script.js"));
    return;
  }
  callApi('getData').then(onData).catch(onError);
}

function onData(data) {
  hideLoadingScreen();
  state.orders = data.orders;
  state.statuses = data.statuses;
  state.sources = data.sources;
  populateOptionLists();
  renderSummary(data.summary);
  renderAll();
  const t = new Date(data.updatedAt);
  document.getElementById('syncLabel').textContent =
    'อัพเดตล่าสุด ' + t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function onError(err) {
  hideLoadingScreen();
  document.getElementById('syncLabel').textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + err.message;
}

function hideLoadingScreen() {
  const el = document.getElementById('loadingScreen');
  if (el) el.classList.add('hide');
}

function populateOptionLists() {
  const sourceFilter = document.getElementById('sourceFilter');
  const fSource = document.getElementById('f_source');
  const fStatus = document.getElementById('f_status');
  if (sourceFilter.dataset.filled) return;

  state.sources.forEach(s => {
    sourceFilter.appendChild(new Option(s, s));
    fSource.appendChild(new Option(s, s));
  });
  state.statuses.forEach(s => fStatus.appendChild(new Option(s, s)));
  sourceFilter.dataset.filled = '1';
}

/* ===== summary ===== */
function renderSummary(summary) {
  document.getElementById('mTotal').textContent = summary.totalCount + ' ชิ้น';
  document.getElementById('mUnpaid').textContent = '฿' + THB.format(summary.totalUnpaidAmount);
  document.getElementById('mUrgent').textContent = summary.urgentCount + ' ชิ้น';
  document.getElementById('mShipping').textContent = summary.shippingCount + ' ชิ้น';
}

function filteredOrders() {
  if (!state.sourceFilter) return state.orders;
  return state.orders.filter(o => o.source === state.sourceFilter);
}

function renderAll() {
  if (state.view === 'list') renderList(); else renderKanban();
}

/* ===== list view ===== */
function urgencyLabel(o) {
  if (o.daysLeft === null) return '';
  if (o.daysLeft < 0) return 'เลยกำหนด ' + Math.abs(o.daysLeft) + ' วัน';
  if (o.daysLeft === 0) return 'ต้องสั่งวันนี้';
  return 'เหลือ ' + o.daysLeft + ' วัน';
}

function renderList() {
  const el = document.getElementById('listView');
  const orders = filteredOrders();
  if (orders.length === 0) {
    el.innerHTML = '<div class="empty-state">ยังไม่มีรายการ กด "เพิ่มรายการ" เพื่อเริ่มต้น</div>';
    return;
  }
  el.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-top">
        <div>
          <p class="order-name" onclick="openModal(${JSON.stringify(o).replace(/"/g, '&quot;')})">${escapeHtml(o.itemName)}</p>
          <div class="badge-row">
            <span class="badge badge-source">${escapeHtml(o.source)}</span>
            ${o.daysLeft !== null ? `<span class="badge badge-urgency-${o.urgency}">${urgencyLabel(o)}</span>` : ''}
          </div>
        </div>
        <span class="badge badge-status" onclick="onCycleStatus('${o.id}')">${escapeHtml(o.status)}</span>
      </div>
      <div class="order-meta">
        <span>จำนวน <b>${o.quantity}</b></span>
        <span>สินค้า <b>฿${THB.format(o.price)}</b></span>
        <span>ค่าส่ง <b>฿${THB.format(o.shipping)}</b></span>
        <span>รวม <b>฿${THB.format(o.total)}</b></span>
        ${o.tracking ? `<span class="mono">${escapeHtml(o.tracking)}</span>` : ''}
      </div>
      ${o.notes ? `<p class="order-notes">${escapeHtml(o.notes)}</p>` : ''}
      ${stepperHtml(o.status)}
    </div>
  `).join('');
}

function stepperHtml(currentStatus) {
  const idx = state.statuses.indexOf(currentStatus);
  const dots = state.statuses.map((s, i) => {
    const dot = `<span class="step-dot ${i <= idx ? 'done' : ''}"></span>`;
    const line = i < state.statuses.length - 1 ? `<span class="step-line ${i < idx ? 'done' : ''}"></span>` : '';
    return dot + line;
  }).join('');
  return `<div class="stepper">${dots}</div>`;
}

/* ===== kanban view ===== */
function renderKanban() {
  const el = document.getElementById('kanbanView');
  const orders = filteredOrders();
  el.innerHTML = state.statuses.map(status => {
    const items = orders.filter(o => o.status === status);
    return `
      <div class="kanban-col" data-status="${escapeHtml(status)}"
           ondragover="onColDragOver(event)" ondragleave="onColDragLeave(event)" ondrop="onColDrop(event)">
        <div class="kanban-col-title"><span>${escapeHtml(status)}</span><span>${items.length}</span></div>
        ${items.map(o => `
          <div class="kanban-card" draggable="true" data-id="${o.id}"
               ondragstart="onCardDragStart(event)"
               onclick="openModal(${JSON.stringify(o).replace(/"/g, '&quot;')})">
            <p class="order-name">${escapeHtml(o.itemName)}</p>
            <div class="badge-row">
              <span class="badge badge-source">${escapeHtml(o.source)}</span>
              ${o.daysLeft !== null ? `<span class="badge badge-urgency-${o.urgency}">${urgencyLabel(o)}</span>` : ''}
            </div>
            ${o.notes ? `<p class="order-notes">${escapeHtml(o.notes)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function onCardDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.closest('.kanban-card').dataset.id);
}
function onColDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onColDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onColDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  const newStatus = e.currentTarget.dataset.status;
  callApi('updateOrder', { id: id, fields: { status: newStatus } })
    .then(onData).catch(onError);
}

/* ===== status cycle (list view badge click) ===== */
function onCycleStatus(id) {
  callApi('cycleStatus', { id: id })
    .then(onData).catch(onError);
}

/* ===== modal ===== */
function openModal(order) {
  state.modalOpen = true;
  const isEdit = !!order;

  const submitBtn = document.querySelector('#orderForm button[type="submit"]');
  submitBtn.disabled = false;
  submitBtn.textContent = 'บันทึก';
  document.getElementById('modalTitle').textContent = isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการสั่งซื้อ';
  document.getElementById('deleteBtn').style.display = isEdit ? 'inline-block' : 'none';

  document.getElementById('f_id').value = isEdit ? order.id : '';
  document.getElementById('f_itemName').value = isEdit ? order.itemName : '';
  document.getElementById('f_quantity').value = isEdit ? order.quantity : 1;
  document.getElementById('f_source').value = isEdit ? order.source : state.sources[0];
  document.getElementById('f_price').value = isEdit ? order.price : 0;
  document.getElementById('f_shipping').value = isEdit ? order.shipping : 0;
  document.getElementById('f_deadline').value = isEdit ? order.deadline : '';
  document.getElementById('f_status').value = isEdit ? order.status : state.statuses[0];
  document.getElementById('f_tracking').value = isEdit ? order.tracking : '';
  document.getElementById('f_notes').value = isEdit ? order.notes : '';

  updateFormTotal();
  document.getElementById('modalBackdrop').style.display = 'flex';
}

function closeModal() {
  state.modalOpen = false;
  document.getElementById('modalBackdrop').style.display = 'none';
}

function onSubmitForm(e) {
  e.preventDefault();
  const id = document.getElementById('f_id').value;
  const fields = {
    itemName: document.getElementById('f_itemName').value,
    quantity: Number(document.getElementById('f_quantity').value) || 0,
    source: document.getElementById('f_source').value,
    price: Number(document.getElementById('f_price').value) || 0,
    shipping: Number(document.getElementById('f_shipping').value) || 0,
    deadline: document.getElementById('f_deadline').value,
    status: document.getElementById('f_status').value,
    tracking: document.getElementById('f_tracking').value,
    notes: document.getElementById('f_notes').value
  };
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังบันทึก...';

  const done = data => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'บันทึก';
    closeModal();
    onData(data);
  };
  const fail = err => { submitBtn.disabled = false; submitBtn.textContent = 'บันทึก'; onError(err); };

  if (id) {
    callApi('updateOrder', { id: id, fields: fields }).then(done).catch(fail);
  } else {
    callApi('addOrder', { order: fields }).then(done).catch(fail);
  }
}

function onDeleteClick() {
  const id = document.getElementById('f_id').value;
  if (!id) return;
  if (!confirm('ลบรายการนี้ใช่ไหม?')) return;
  callApi('deleteOrder', { id: id })
    .then(data => { closeModal(); onData(data); })
    .catch(onError);
}

/* ===== utils ===== */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
