
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
        document.getElementById('editProductId').value    = data.id;
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

    function deleteProduct(id) {
        // TODO: wire up to backend
    }

    document.getElementById('editOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeEditPopup();
    });
