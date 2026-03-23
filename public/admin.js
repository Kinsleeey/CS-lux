const TOAST_DURATION = 2000;
 
const TOAST_ICONS = {
    success: '✓',
    error:   '✕',
    info:    'i'
};
 
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type]}</div>
    <div class="toast-content">
        <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="dismissToast(this.closest('.toast'))">✕</button>
    <div class="toast-progress" style="animation-duration: ${TOAST_DURATION}ms"></div>
    `;

    document.getElementById('toast-container').appendChild(toast);

    requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
    });

    toast._timer = setTimeout(() => dismissToast(toast), TOAST_DURATION);
}
 
function dismissToast(toast) {
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}


    function showSection(name) {
        ['categories', 'products', 'orders', 'stock'].forEach(s => {
            document.getElementById('section-' + s).style.display = s === name ? 'block' : 'none';
        });
        document.querySelectorAll('.sidebar-item').forEach((item, i) => {
            item.classList.toggle('active', ['categories', 'products', 'orders', 'stock'][i] === name);
        });
    }

    function addRow() {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
            <input type="text" name="sizes[]" placeholder="Size (e.g. M)" required>
            <input type="number" name="stock[]" placeholder="Stock" required>
            <button type="button" class="btn-remove" onclick="removeRow(this)">×</button>
        `;
        document.getElementById('rows').appendChild(div);
        updateSingleStock();
    }

    function removeRow(btn) {
        btn.closest('.row').remove();
        updateSingleStock();
    }

    function updateSingleStock() {
        const hasRows = document.querySelectorAll('.row').length > 0;
        document.getElementById('single-stock').style.display = hasRows ? 'none' : '';
    }

    function previewImage(input) {
        const preview = document.getElementById('image-preview');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(input.files[0]);
        } else {
            preview.src = '';
            preview.style.display = 'none';
        }
    }

    function toggleOrderList(orderId) {
        const list = document.getElementById('order-list-' + orderId);
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    }

    let activeFilter = 'all';

    function setFilter(filter, btn) {
        activeFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
        filterStock();
    }

    function filterStock() {
        const query = document.getElementById('stockSearch').value.toLowerCase();
        const rows = document.querySelectorAll('.stock-row-item');
        let visible = 0;
        rows.forEach(row => {
            const match = row.dataset.name.includes(query) &&
                          (activeFilter === 'all' || row.dataset.status === activeFilter);
            row.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        document.getElementById('stockEmpty').style.display = visible === 0 ? 'block' : 'none';
    }

    function editProduct(data) {
        document.getElementById('editVariantId').value  = data.variantId;       // product id
        document.getElementById('editProductId').value  = data.productId; // variant id
        document.getElementById('editProductName').value  = data.name;
        document.getElementById('editProductPrice').value = data.price;
        document.getElementById('editProductStock').value = data.stock;
        document.getElementById('editOverlay').classList.add('open');
    }

    function closeEditPopup() {
        document.getElementById('editOverlay').classList.remove('open');
    }

    function saveProductChanges() {
        // TODO: wire up to backend
        closeEditPopup();
    }
    async function removeCategory(id) {
        try {
            const response = await fetch(`/category/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                const data = await response.json();

                showToast(data.message, 'success');

                setTimeout(() => {
                    window.location.href = '/admin';
                }, 2000);
            } else if (response.status === 400) {
                const data = await response.json();
                showToast(data.message, 'info');
            } else {
                showToast('Failed to delete category', 'error');
            }
        } catch (err) {

        }
    }

    async function patchVariant() {
        const variantId = document.getElementById('editVariantId').value;
        const productId = document.getElementById('editProductId').value;
        const name      = document.getElementById('editProductName').value;
        const price     = document.getElementById('editProductPrice').value;
        const stock     = document.getElementById('editProductStock').value;

        try {
            const response = await fetch(`/variant/${variantId}/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, price, stock })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                setTimeout(() => window.location.href = '/admin', 2000);
            } else {
                showToast(data.message || 'Failed to edit product variant', 'error');
            }
            closeEditPopup();
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to edit product variant', 'error');
        }
    }

   async function deleteVariant(variantId, productId) {
        try {
            const response = await fetch(`/variant/${variantId}/${productId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                setTimeout(() => window.location.href = '/admin', 2000);
            } else {
                showToast(data.message || 'Failed to remove product', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to remove product', 'error');
        }
    }

    document.getElementById('editOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeEditPopup();
    });
