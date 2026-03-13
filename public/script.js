const profile = document.querySelector("#user-profile");
const profileNav = document.querySelector(".profile-nav");
const cancelEdit = document.querySelector("#cancel-edit");
const edit = document.querySelector(".edit");
const cartCountElement = document.getElementById("cart-count");
const productPrices = document.querySelectorAll(".product-price");
const subTotal = document.querySelector(".subtotal");
const total = document.querySelector(".total");
let cartCount = 0;

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
            alert('Product added to cart!');
        } else if (response.status === 409) {
            const data = await response.json();
            alert(data.message);
        } else {
            alert('Failed to add to cart');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to add to cart');
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
            alert('cart update sucessfull');
        } else {
            alert('Failed to update cart');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update cart');
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
            window.location.href = '/cart';
            alert('Product added to cart!');
        } else if (response.status === 409) {
            const data = await response.json();
            alert(data.message);
        } else {
            alert('Failed to add to cart');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to add to cart');
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
            window.location.href = '/cart';
            alert('cart update sucessfull');
        } else {
            alert('Failed to update cart');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to update cart');
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
            alert('Product removed from cart!');
        } else {
            alert('Failed to remove from cart');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to remove from cart');
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
                alert('Product already exist in Wishlist!');
            } else {
                alert('Product added to Wishlist!');
            }
        } else {
            alert('Failed to add product to wishlist');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to add product to wishlist');
    }
}

async function removeFromWishlist(productId) {
    try {
        const response = await fetch(`/wishlist/${productId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const data = await response.json();
            window.location.href = '/wishlist';
            alert(data.message);
        } else {
            alert('Failed to remove from wishlist');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to remove from wishlist');
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
//product sidebar active
var currentPath = window.location.pathname;
var navLinks = document.querySelectorAll('.p-page-nav a');

navLinks.forEach(function(link) {
    if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
    }
});