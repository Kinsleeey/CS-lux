document.addEventListener('DOMContentLoaded', function() {

    const profile = document.querySelector("#user-profile");
    const profileNav = document.querySelector(".profile-nav");
    const cancelEdit = document.querySelector("#cancel-edit");
    const edit = document.querySelector(".edit");
    const cartCountElement = document.getElementById("cart-count");
    let cartCount = 0;

    //cart//
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

    //profile//
    profile.addEventListener("click", () => {
        profileNav.classList.toggle("hide")
    })

    if (cancelEdit) {
    cancelEdit.addEventListener("click", () => {
        edit.classList.add("hide")
    })
}


    //info.ejs js //

    function changeImage(imagePath) {
        document.getElementById('product-image-in-info').src = imagePath;
    }


    //cart//
    async function addToCart(productId) {
        try {
            const response = await fetch(`/cart/${productId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const data = await response.json();
                cartCount = data.count;
                cartCountElement.textContent = cartCount;
                alert('Product added to cart!');
            } else {
                alert('Failed to add to cart');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to add to cart');
        }
    }

});