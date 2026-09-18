const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function api(path, options = {}) {
  const response = await fetch('/api/' + path, {
    ...options,
    headers: {
      'X-Andallo-Role': currentUser?.role || 'customer',
      'X-Andallo-Email': currentUser?.email || 'customer@example.invalid',
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Gagal menyimpan. Coba lagi.');
  return data;
}

async function loadBookings() {
  try {
    bookings = await api('bookings');
    if (currentUser) {
      renderCustomerDashboard();
      renderAdminDashboard();
    }
  } catch (error) {
    showToast(error.message);
  }
}

const baseLogin = handleLoginSubmit;
handleLoginSubmit = function (event) {
  baseLogin(event);
  if (currentUser) loadBookings();
};

const baseVerify = confirmVerification;
confirmVerification = function () {
  baseVerify();
  if (currentUser) loadBookings();
};

const baseDashboard = goToDashboard;
goToDashboard = function () {
  baseDashboard();
  loadBookings();
};

let bookingDraftId = null;
let bookingPreviewUrl = null;

function previewBookingProof(input) {
  const file = input.files?.[0];
  const preview = document.getElementById('bookingProofPreview');
  const image = preview.querySelector('img');
  const label = preview.querySelector('span');
  if (bookingPreviewUrl) URL.revokeObjectURL(bookingPreviewUrl);
  if (!file) {
    preview.classList.remove('show');
    return;
  }
  bookingPreviewUrl = URL.createObjectURL(file);
  image.src = bookingPreviewUrl;
  label.textContent = file.name;
  preview.classList.add('show');
}

handleBookingSubmit = async function (event) {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  const feedback = document.getElementById('bookingFeedback');
  const proof = document.getElementById('bookingProof').files?.[0];
  if (!proof || !['image/jpeg', 'image/png'].includes(proof.type) || proof.size > 5 * 1024 * 1024) {
    feedback.textContent = 'Pilih bukti transfer JPG atau PNG dengan ukuran maksimal 5 MB.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Mengirim booking...';
  feedback.textContent = 'Booking dan bukti transfer sedang disimpan.';
  try {
    if (!bookingDraftId) {
      const booking = await api('bookings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          providerId: currentDetailId,
          date: document.getElementById('bookingDate').value,
          time: document.getElementById('bookingTime').value
        })
      });
      bookingDraftId = booking.id;
    }

    await api('bookings/' + bookingDraftId + '/proof', {
      method: 'POST',
      headers: {'Content-Type': proof.type},
      body: proof
    });
    bookingDraftId = null;
    await loadBookings();
    closeModal('modalBooking');
    showToast('Booking terkirim. Mitra akan memeriksa pembayaranmu.');
    showPage('dashboard-customer');
  } catch (error) {
    feedback.textContent = error.message + (bookingDraftId ? ' Tekan kirim lagi untuk melanjutkan upload.' : '');
  } finally {
    button.disabled = false;
    button.textContent = 'Kirim Booking & Bukti Transfer';
  }
};

const baseOpenBooking = openBookingModal;
openBookingModal = function (id) {
  bookingDraftId = null;
  baseOpenBooking(id);
  document.getElementById('bookingDate').min = new Date().toLocaleDateString('en-CA');
};

const baseCustomerDashboard = renderCustomerDashboard;
renderCustomerDashboard = function () {
  baseCustomerDashboard();
  if (!currentUser) return;
  const rows = [...document.getElementById('customerBookingList').children];
  const list = bookings.filter(item => item.customerEmail === currentUser.email).sort((a, b) => b.id - a.id);
  list.forEach((booking, index) => {
    const detail = booking.proof
      ? `<a href="/api/bookings/${booking.id}/proof" target="_blank" rel="noopener" class="text-sm font-bold text-sky-700 underline">Lihat bukti transfer</a>`
      : '<span class="text-sm text-amber-700">Bukti transfer belum tersedia.</span>';
    rows[index]?.insertAdjacentHTML('beforeend', `<div class="w-full"><p class="payment-steps">Booking dikirim → Pembayaran diperiksa → Pesanan diterima → Layanan diproses</p>${detail}</div>`);
  });
};

renderAdminDashboard = function () {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('adminDashTitle').textContent = 'Dashboard Mitra';
  document.getElementById('adminDashSub').textContent = 'Tinjau detail pesanan, pelanggan, bukti transfer, dan proses layanan dari satu halaman.';
  const list = bookings
    .filter(item => isAdmin || providers.find(provider => provider.id === item.providerId)?.providerEmail === currentUser.email)
    .sort((a, b) => b.id - a.id);

  document.getElementById('adminBookingTable').innerHTML = list.length ? list.map(booking => {
    const provider = providers.find(item => item.id === booking.providerId);
    const customer = users.find(item => item.email === booking.customerEmail);
    const proof = booking.proof
      ? `<a href="/api/bookings/${booking.id}/proof" target="_blank" rel="noopener" aria-label="Buka bukti transfer pesanan ${booking.id}"><img src="/api/bookings/${booking.id}/proof" class="receipt-thumb" alt="Bukti transfer pesanan ${booking.id}"></a>`
      : '<span class="text-xs text-[#66716A]">Belum diunggah</span>';
    let action = '<span class="text-xs text-[#66716A]">Tidak ada aksi</span>';
    if (booking.status === 'PENDING' || booking.status === 'AWAITING_PAYMENT') action = '<span class="text-xs text-amber-700">Menunggu bukti</span>';
    if (booking.status === 'PAYMENT_REVIEW') action = `<button class="pay-button" onclick="updateBookingStatus(${booking.id},'DITERIMA')"><i class="fa-solid fa-check mr-1"></i> Terima Pembayaran</button>`;
    if (booking.status === 'DITERIMA' || booking.status === 'DIMULAI') action = `<button class="pay-button" onclick="updateBookingStatus(${booking.id},'ON_PROGRESS')">Mulai Layanan</button>`;
    if (booking.status === 'ON_PROGRESS') action = `<button class="pay-button" onclick="updateBookingStatus(${booking.id},'SELESAI')">Selesaikan</button>`;
    return `<tr class="border-b border-sky-100 last:border-0">
      <td class="p-4"><b class="block">${esc(customer?.name || booking.customerEmail)}</b><span class="text-xs text-[#66716A]">${esc(booking.customerEmail)}</span></td>
      <td class="p-4">${esc(provider?.name)}</td>
      <td class="p-4">${esc(booking.date)} · ${esc(booking.time)}</td>
      <td class="p-4 font-bold">Rp${booking.total.toLocaleString('id-ID')}</td>
      <td class="p-4">${proof}</td>
      <td class="p-4"><span class="text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[booking.status] || 'bg-slate-100 text-slate-700'}">${STATUS_LABEL[booking.status] || booking.status}</span></td>
      <td class="p-4">${action}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="p-10 text-center text-[#66716A]">Belum ada pesanan masuk.</td></tr>';
};

async function updateBookingStatus(id, status) {
  try {
    await api('bookings/' + id, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status})
    });
    await loadBookings();
    closeModal('modalPayment');
    showToast(`Status pesanan berubah menjadi ${STATUS_LABEL[status]}.`);
  } catch (error) {
    showToast(error.message);
  }
}

document.body.insertAdjacentHTML('beforeend', '<div id="modalPayment" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="paymentTitle"><div class="modal-box bg-white rounded-2xl p-6 w-full max-w-xl"><div class="flex justify-between items-center"><h2 id="paymentTitle" class="text-xl font-bold">Detail pembayaran</h2><button onclick="closeModal(\'modalPayment\')" aria-label="Tutup" class="p-3">✕</button></div><div id="paymentContent"></div></div></div>');

function openPayment(id) {
  const booking = bookings.find(item => item.id === id);
  if (!booking) return;
  const provider = providers.find(item => item.id === booking.providerId);
  document.getElementById('paymentContent').innerHTML = `<div class="payment-panel">
    <h3>Rp${booking.total.toLocaleString('id-ID')}</h3>
    <p>${esc(provider?.name)} · Pesanan #${booking.id}</p>
    <p class="payment-status">${STATUS_LABEL[booking.status]}</p>
    ${booking.proof ? `<a href="/api/bookings/${booking.id}/proof" target="_blank" rel="noopener"><img src="/api/bookings/${booking.id}/proof" class="w-full max-h-80 object-contain rounded-xl bg-white" alt="Bukti transfer"></a>` : '<p>Bukti transfer belum tersedia.</p>'}
    ${currentUser.role !== 'customer' && booking.status === 'PAYMENT_REVIEW' ? `<div class="payment-actions"><button onclick="updateBookingStatus(${booking.id},'DITERIMA')">Terima Pembayaran</button></div>` : ''}
  </div>`;
  openModal('modalPayment');
}

const baseChat = renderChat;
renderChat = function () {
  baseChat();
  if (!document.getElementById('chatTemplates')) document.getElementById('chatInput').closest('form').insertAdjacentHTML('beforebegin', '<div id="chatTemplates" class="flex gap-2 flex-wrap p-3"></div>');
  document.getElementById('chatTemplates').innerHTML = ['Halo, kapan layanan ini diproses?', 'Kapan penyedia menghubungi saya?', 'Apakah pembayaran sudah diterima?'].map(question => `<button class="px-3 py-2 rounded-full border text-sm" onclick="document.getElementById('chatInput').value=this.textContent">${question}</button>`).join('');
};

sendChatMessage = async function (event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const value = input.value.trim();
  if (!value) return;
  try {
    await api('bookings/' + currentChatBookingId + '/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: value})
    });
    input.value = '';
    await loadBookings();
    renderChatMessages();
  } catch (error) {
    showToast(error.message);
  }
};

submitRating = async function (event) {
  event.preventDefault();
  if (!selectedStars) return showToast('Pilih jumlah bintang dulu.');
  try {
    await api('bookings/' + currentRatingBookingId + '/rating', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({stars: selectedStars, text: document.getElementById('ratingUlasan').value.trim()})
    });
    await loadBookings();
    closeModal('modalRating');
    showToast('Ulasan berhasil dikirim.');
  } catch (error) {
    showToast(error.message);
  }
};

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(modal => closeModal(modal.id));
});
window.addEventListener('focus', () => { if (currentUser) loadBookings(); });
loadBookings();
