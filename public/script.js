const profile = document.querySelector("#user-profile");
const closeProfile = document.getElementById("close-profile");
const profileNav = document.querySelector(".profile-nav");
const cancelEdit = document.querySelector("#cancel-edit");
const edit = document.querySelector(".edit");
const cartCountElement = document.getElementById("cart-count");
const productPrices = document.querySelectorAll(".product-price");
const subTotal = document.querySelector(".subtotal");
const total = document.querySelector(".total");
let cartCount = 0;


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

function showPageLoader() {
  document.getElementById('page-loader').classList.add('active');
}

function hidePageLoader() {
  document.getElementById('page-loader').classList.remove('active');
}

window.addEventListener('load', function() {
  hidePageLoader();
});
window.addEventListener('pageshow', function() {
  hidePageLoader();
});
document.addEventListener('DOMContentLoaded', function() {
  hidePageLoader();
});

document.addEventListener('click', function(e) {
  if (e.target.closest('.spinner')) {
    showPageLoader();
  }
});


function toggleSearch() {
    const bar = document.getElementById('search-bar');
    const isVisible = bar.style.display === 'block';
    bar.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) document.getElementById('search-input').focus();
}

if (subTotal && total && productPrices.length > 0) {
    let totalPrice = 0;
    productPrices.forEach(price => {
        const cleaned = Number(price.textContent.replace('₦', '').replace(/,/g, ''));
        totalPrice += cleaned;
    });
    subTotal.textContent = "₦" + totalPrice.toLocaleString('en-NG');
    total.textContent = "₦" + totalPrice.toLocaleString('en-NG');
}

async function loadCartCount() {
    try {
        const response = await fetch('/cart/count');
        const data = await response.json();
        cartCount = data.count;
        cartCountElement.textContent = cartCount;
    } catch (error) {
        console.error('Error loading cart count:', error);
    }
}

loadCartCount();

if (profile) {
    profile.addEventListener("click", () => {
        profileNav.classList.toggle("hide");
    });
}
if (closeProfile ) {
    closeProfile.addEventListener("click", () => {
        profileNav.classList.add("hide");
    });
}

if (cancelEdit) {
    cancelEdit.addEventListener("click", () => {
        edit.classList.add("hide");
    });
}

async function addToCart(variantId, qty, stock) {
    try {
        const response = await fetch(`/cart/${variantId}/${qty}/${stock}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            cartCount = data.count;
            cartCountElement.textContent = cartCount;
            showToast('Product added to cart!', 'info');
        } else if (response.status === 409) {
            const data = await response.json();
            showToast(data.message, 'info');
        } else {
            showToast('Failed to add to cart', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to add to cart', 'error');
    }
}

async function reduceFromCart(variantId) {
    try {
        const response = await fetch(`/cart/${variantId}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            const data = await response.json();
            cartCount = data.count;
            cartCountElement.textContent = cartCount;
            showToast('Cart updated successfully!', 'success');
        } else {
            showToast('Failed to remove product from cart', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to remove product from cart', 'error');
    }
}

async function cAddToCart(variantId, qty, stock) {
    try {
        const response = await fetch(`/cart/${variantId}/${qty}/${stock}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            cartCount = data.count;
            cartCountElement.textContent = cartCount;
            showToast('Product added to cart!', 'info');

            setTimeout(() => {
                window.location.href = '/cart';
            }, 2000);
        } else if (response.status === 409) {
            const data = await response.json();
            showToast(data.message, 'info'); // ← was alert()
        } else {
            showToast('Failed to add to cart', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to add to cart', 'error');
    }
}

async function cReduceFromCart(variantId) {
    try {
        const response = await fetch(`/cart/${variantId}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            const data = await response.json();
            cartCount = data.count;
            cartCountElement.textContent = cartCount;
            showToast('Cart updated successfully!', 'success');

            setTimeout(() => {
                window.location.href = '/cart';
            }, 2000); 
        } else {
            showToast('Failed to remove product from cart', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to remove product from cart', 'error');
    }
}

async function removeFromCart(variantId) {
    try {
        const response = await fetch(`/cart/${variantId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const data = await response.json();
            cartCount = data.count;
            cartCountElement.textContent = cartCount;
            window.location.href = '/cart';
            showToast('Product removed from cart!', 'success');
        } else {
            showToast('Failed to remove from cart!', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to remove from cart!', 'error');
    }
}

async function addToWishlist(productId) {
    try {
        const response = await fetch(`/wishlist/${productId}`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            if (data.message === "An error occured") {
                showToast('Product already exist in Wishlist!', 'info');
            } else {
                showToast('Product added to Wishlist!', 'success');
            }
        } else {
            showToast('Failed to add product to wishlist', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to add product to wishlist', 'error');
        
    }
}

async function removeFromWishlist(productId) {
    try {
        const response = await fetch(`/wishlist/${productId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const data = await response.json();
            showToast(data.message, 'success');

            setTimeout(() => {
                window.location.href = '/wishlist';
            }, 2000);
        } else {
            showToast('Failed to remove from wishlist', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to remove from wishlist', 'error');
    }
}

function openPopup(id) {
    document.getElementById(`xyz-overlay${id}`).classList.add('active');
}

function closePopup(id) {
    document.getElementById(`xyz-overlay${id}`).classList.remove('active');
}

function changeQty(btn, delta) {
    const qtyEl = btn.parentElement.querySelector('.xyz-qty-value');
    const stock = parseInt(qtyEl.dataset.stock);
    let current = parseInt(qtyEl.textContent);
    current += delta;
    if (current < 0) current = 0;
    if (current > stock) current = stock;
    qtyEl.textContent = current;
}



//sort
function toggleSortDropdown() {
    document.getElementById('sortDropdown').classList.toggle('open');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.sort-wrapper')) {
        document.getElementById('sortDropdown').classList.remove('open');
    }
});

function sortProducts(order) {
    var grid = document.querySelector('.p-page-display');
    var items = Array.from(document.querySelectorAll('.item'));

    items.sort(function(a, b) {
        var priceA = Number(a.dataset.price);
        var priceB = Number(b.dataset.price);
        if (order === 'high-low') return priceB - priceA;
        if (order === 'low-high') return priceA - priceB;
    });

    items.forEach(function(item) {
        var overlay = item.nextElementSibling; // the xyz-overlay right after each item
        grid.appendChild(item);
        grid.appendChild(overlay);
    });
}

function sortRelatedProducts(order) {
    var grid = document.querySelector('.info-page-display');
    var items = Array.from(document.querySelectorAll('.item'));

    items.sort(function(a, b) {
        var priceA = Number(a.dataset.price);
        var priceB = Number(b.dataset.price);
        if (order === 'high-low') return priceB - priceA;
        if (order === 'low-high') return priceA - priceB;
    });

    items.forEach(function(item) {
        var overlay = item.nextElementSibling; // the xyz-overlay right after each item
        grid.appendChild(item);
        grid.appendChild(overlay);
    });
}

// //product sidebar active
// var currentPath = window.location.pathname;
// var navLinks = document.querySelectorAll('.p-page-nav a');

// navLinks.forEach(function(link) {
//     if (link.getAttribute('href') === currentPath) {
//         link.classList.add('active');
//     }
// });


