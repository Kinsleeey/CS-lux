import express from "express";
import bodyParser from "body-parser";
import path from 'path';
import multer from "multer";
import pg from "pg"
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt"
import env from "dotenv"
import axios from "axios";

env.config();

const { Pool } = pg;
const db = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
          }
        : {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
          }
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 3;

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_SECRET}`,
  "Content-Type": "application/json",
};

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000*60*60*72
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(async (req, res, next) => {
    const user =  req.user;
    var currentUser;
  try {
    const result = await db.query("SELECT * FROM categories");
    if (user) {
        const result2 = await db.query("SELECT * FROM users WHERE id = $1", [user.id]);
        currentUser = result2.rows;
    } else {
        currentUser = [];
    }
    
    res.locals.currentUser = currentUser;
    const categories = result.rows;
    res.locals.categories = categories;
    
    next();
  } catch (err) {
    next(err);
  }
});


app.set('view engine', 'ejs');
app.set('views', './views')

async function calculateCartTotal(userId) {
    const result = await db.query(`
        SELECT 
            p.price,
            c.qty
        FROM cart c
        JOIN product_variants pv ON c.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE c.user_id = $1`,
        [userId]);

    const sum = result.rows.reduce((acc, current) => acc + (Number(current.price) * current.qty), 0);
    return sum;
}

async function getProductDetails(id) {

    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.description,
                c.name AS category,
                p.price,
                p.image
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.id = $1
        `, [id])
            return result.rows;
        } catch (err) {
            console.error(err);
            return null;
        }
};

async function getVariantDetails(productId) {

    try {
        const result = await db.query(`
            SELECT 
                pv.id,
                pv.product_id,
                pv.size,
                pv.stock
                FROM product_variants pv
                WHERE pv.product_id = $1
        `, [productId])
            return result.rows;
        } catch (err) {
            console.error(err);
            return null;
        }
};

app.get("/", async(req, res) => {
    if(req.user) {
        console.log("Logged in")
        console.log(req.user);
    } else {
        console.log("Not Logged in")
    }
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.image,
                p.price,
                c.name AS category
                FROM products p
                JOIN categories c ON p.category_id = c.id
            `, )
        
        const products = result.rows;

        let variants = [];
        const productIdArr = products.map(product => product.id);

        for (let productId of productIdArr) {
            const variant = await getVariantDetails(productId);    
            variants.push(variant);
        }


        res.render("index.ejs", { popupmsg: req.query.loginerror ? "Wrong email or password." : "", products, variants });

    } catch(err) {
        console.log(err)
        res.status(404).send("error retrieving Categories/product")

    }

})

app.get("/product/:categoryId", async(req, res) => {
    const specificId = req.params.categoryId;

    const result = await db.query(`
        SELECT 
            p.id,
            p.name,
            p.price,
            p.image,
            p.price,
            c.name AS category
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE category_id = $1
        `, [specificId])

    const products = result.rows;

    let variants = [];
    const varArr = products.map(product => product.id);
    

    for (let v of varArr) {
        const variant = await getVariantDetails(v);    
        variants.push(variant);
    }
    
    if(products.length === 0) {
        return res.render("product.ejs", { msg: "No Products Available", products: [], popupmsg: "" })
    }

    res.render("product.ejs", { msg: "", products, variants, popupmsg: "" });
})

app.post("/login", (req, res, next) => {
    passport.authenticate("local", async (err, user) => {
        if (!user) {
            return res.redirect(req.headers.referer + '?loginerror=true');
        }

        req.logIn(user, { keepSessionInfo: true }, async (err) => {
            if (err) return next(err);
            
            const cart = req.session.cart;

            if (cart && cart.length > 0) {
                for (let i = 0; i < cart.length; i++) {
                    await db.query(
                        `INSERT INTO cart (user_id, variant_id, qty) 
                        VALUES ($1, $2, $3)
                        ON CONFLICT (user_id, variant_id) 
                        DO UPDATE SET qty = cart.qty + EXCLUDED.qty`,
                        [req.user.id, cart[i].variant_id, cart[i].qty]
                    );
                }
                req.session.cart = [];
            }

            const redirectTo = req.session.returnTo || "/";
            delete req.session.returnTo;
            res.redirect(redirectTo);
        });
    })(req, res, next);
});

app.post("/register", async(req, res) => {
    const userEmail = req.body.email;
    const userPassword = req.body.password;

    try {
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [userEmail]);

        if (checkResult.rows.length > 0) {
            return res.render("sign-up", { msg: "Email already exists. Try logging in." });
        }

        const hashedUserPassword = await bcrypt.hash(userPassword, saltRounds);
        const insertResult = await db.query(
            "INSERT INTO users (email, password_hash) VALUES($1, $2) RETURNING id, email", 
            [userEmail, hashedUserPassword]
        );
        
        const newUser = insertResult.rows[0];

        const cart = req.session.cart ? [...req.session.cart] : [];
        const redirectUrl = req.session.returnTo;

        req.login(newUser, async (err) => {

            if (err) {
                console.error("Auto-login error:", err);
                return res.render("sign-up", { 
                    msg: "Registration successful! Please login." 
                });
            }


            if (cart && cart.length > 0) {
                for (let i = 0; i < cart.length; i++) {
                    await db.query(
                        `INSERT INTO cart (user_id, variant_id, qty) 
                        VALUES ($1, $2, $3)
                        ON CONFLICT (user_id, variant_id) 
                        DO UPDATE SET qty = cart.qty + EXCLUDED.qty`,
                        [newUser.id, cart[i].variant_id, cart[i].qty]
                    );
                }
                req.session.cart = [];
            }

            const redirectTo = redirectUrl || "/";
            delete req.session.returnTo;
            res.redirect(redirectTo);

        });

    } catch (err) {
        console.log(err);
        res.render("sign-up", { msg: "Registration failed. Please try again." });
    }

});

app.get("/info/:category/:id", async(req, res) => {
    const specificId = req.params.id;
    const specifiedCategory = req.params.category;

    const result = await db.query(
            `SELECT 
                p.id,
                p.name,
                p.price,
                p.image,
                c.name AS category
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE c.name = $1`, [specifiedCategory]
    );

    const relatedProducts = result.rows;

    const product = await getProductDetails(specificId); 
    const variants = await getVariantDetails(specificId); 
    console.log(product)
    console.log(variants)
    
    res.render("info.ejs", { product: product[0], variants, relatedProducts, popupmsg: "" })
})

app.get("/cart", async(req, res) => {

    if(!req.user) {
        const productsIncart = req.session.cart || [];
        let cartedProducts = [];

        for (let v of productsIncart) {

            const result = await db.query(`
                SELECT 
                    p.name,
                    p.image,
                    p.price,
                    pv.id,
                    pv.size,
                    pv.stock
                    FROM product_variants pv
                    JOIN products p ON pv.product_id = p.id
                    WHERE pv.id = $1`,
                [v.variant_id]
            );

            let actualResult = result.rows;
            actualResult[0].qty = v.qty;
            cartedProducts.push(actualResult[0]);
            
        }

        return res.render("cart.ejs", { cartedProducts, popupmsg: "" });
    }

    const userId = req.user.id;

    const result = await db.query(`
            SELECT 
                p.name,
                p.image,
                p.price,
                pv.id,
                pv.size,
                pv.stock,
                c.qty
                FROM cart c
                JOIN product_variants pv ON c.variant_id = pv.id
                JOIN products p ON pv.product_id = p.id
                WHERE c.user_id = $1`,
            [userId]);

    const cartedProducts = result.rows;

    res.render("cart.ejs", { cartedProducts, popupmsg: "" }); 
})

app.get("/cart/count", async(req, res) => {
    let count = 0;
    
    if (req.user) {
        const userId = req.user.id;
        const result = await db.query("SELECT COUNT(*) FROM cart WHERE user_id = $1", [userId]);
        count = parseInt(result.rows[0].count);
    } else if (req.session.cart) {
        count = req.session.cart.length;
    }
    
    res.json({ count: count });
});

app.post("/cart/:id/:qty/:stock", async(req, res) => {

     const variantId = req.params.id;
     const qty = req.params.qty;
     const stock = req.params.stock;

    // Initialize session cart if it doesn't exist
    if (!req.session.cart) {
        req.session.cart = [];
    }
    
    let count = 0;
    
    if (req.user) {
        // User is logged in - save to database
        const userId = req.user.id;
        
        const cartResult = await db.query(
            `SELECT qty FROM cart WHERE user_id = $1 AND variant_id = $2`,
            [userId, variantId]
        );

        const currentQty = cartResult.rows.length > 0 ? cartResult.rows[0].qty : 0;

        if (parseInt(currentQty) + parseInt(qty) > parseInt(stock)) {
            return res.status(409).json({ message: 'Product out of stock' });
        }

        await db.query(`
                INSERT INTO cart (user_id, variant_id, qty)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, variant_id)
                DO UPDATE SET qty = cart.qty + EXCLUDED.qty
            `, [userId, variantId, qty])

        // Get cart count from database
        const result = await db.query("SELECT COUNT(*) FROM cart WHERE user_id = $1", [userId]);
        count = parseInt(result.rows[0].count);

    } else {
        // User not logged in - save to session
        const existing = req.session.cart.find(item => item.variant_id === variantId);

        if (existing) {
            existing.qty = parseInt(existing.qty) + parseInt(qty);
        } else {
            req.session.cart.push({ variant_id: variantId, qty: parseInt(qty) });
        }
        count = req.session.cart.length;
    }
    
    res.json({ success: true, count: count });
});

app.patch("/cart/:id", async(req, res) => {
    const variantId = req.params.id;
    let count = 0;

    if (req.user) {
        const userId = req.user.id;

        // Get current qty
        const cartResult = await db.query(
            `SELECT qty FROM cart WHERE user_id = $1 AND variant_id = $2`,
            [userId, variantId]
        );

        const currentQty = cartResult.rows[0].qty;

        if (currentQty <= 1) {
            // Remove from cart if qty is 1
            await db.query(
                `DELETE FROM cart WHERE user_id = $1 AND variant_id = $2`,
                [userId, variantId]
            );
        } else {
            // Reduce qty by 1
            await db.query(
                `UPDATE cart SET qty = qty - 1 WHERE user_id = $1 AND variant_id = $2`,
                [userId, variantId]
            );
        }

        const result = await db.query("SELECT COUNT(*) FROM cart WHERE user_id = $1", [userId]);
        count = parseInt(result.rows[0].count);

    } else {
        const existing = req.session.cart.find(item => item.variant_id === variantId);

        if (existing) {
            if (existing.qty <= 1) {
                req.session.cart = req.session.cart.filter(item => item.variant_id !== variantId);
            } else {
                existing.qty -= 1;
            }
        }
        count = req.session.cart.length;
    }

    res.json({ success: true, count: count });
});

app.delete("/cart/:id", async(req, res) => {
    const variantId = req.params.id;
    let count = 0;

    if (req.user) {
        const userId = req.user.id;

        await db.query(
            `DELETE FROM cart WHERE user_id = $1 AND variant_id = $2`,
            [userId, variantId]
        );

        const result = await db.query("SELECT COUNT(*) FROM cart WHERE user_id = $1", [userId]);
        count = parseInt(result.rows[0].count);

    } else {
        req.session.cart = req.session.cart.filter(item => item.variant_id !== variantId);
        count = req.session.cart.length;
    }

    res.json({ success: true, count: count });
});

app.get("/checkout", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = "/checkout";
    req.session.save(() => {
        res.redirect("/sign-in");
    });
    return;
  };

  const userId = req.user.id;
  
  try {
    const subtotal = await calculateCartTotal(userId);
    const shippingFee = 2000;
    const total = subtotal + shippingFee;

    const userResult = await db.query(
      `SELECT first_name, last_name, email, phone, address, city, state, country 
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];

    res.render("checkout.ejs", { subtotal, shippingFee, total, user, popupmsg: "" });
  } catch (err) {
    console.log(err);
  }
});

app.get("/track-order", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = "/track-order";
    req.session.save(() => {
      res.redirect("/sign-in");
    });
    return;
  }

  try {
    const userId = req.user.id;

    const ordersResult = await db.query(
      `SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.delivery_location,
        o.created_at,
        d.name AS delivery_type
      FROM orders o
      JOIN delivery_options d ON o.delivery_option_id = d.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
      [userId]
    );

    const orders = ordersResult.rows;

    // Get items for each order
    for (let order of orders) {
      const itemsResult = await db.query(
        `SELECT 
          p.name,
          p.image,
          pv.size,
          oi.qty,
          oi.price
        FROM order_details oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;
    }

    res.render("track-order.ejs", { orders, popupmsg: "" });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching orders");
  }
});

app.get("/wishlist", async(req, res) => {

    if (!req.user) {
        const wishlistProducts = req.session.wishlist || [];
        let products = [];
        let variants = [];

        for (let w of wishlistProducts) {

            const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.image,
                p.price,
                c.name AS category
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.id = $1
            `, [w.product_id]);
            const actualResult = result.rows;
            products.push(actualResult[0]);

            const variant = await getVariantDetails(w.product_id);    
            variants.push(variant);

        }

        if(products.length === 0) {
            return res.render("wishlist.ejs", { msg: "No Products Available", products: [], variants, popupmsg: "" })
        }

        return res.render("wishlist.ejs", { msg: "", products, variants, popupmsg: "" });

    } 

    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.image,
                p.price,
                c.name AS category
                FROM wishlist w
                JOIN products p ON w.product_id = p.id
                JOIN categories c ON p.category_id = c.id
                WHERE w.user_id = $1
            `, [req.user.id] );
        
        const products = result.rows;

        let variants = [];
        const varArr = products.map(product => product.id);

        for (let v of varArr) {
            const variant = await getVariantDetails(v);    
            variants.push(variant);
        }

        if(products.length === 0) {
            return res.render("wishlist.ejs", { msg: "No Products Available", products: [], variants, popupmsg: "" })
        }

        return res.render("wishlist.ejs", { msg: "", products, variants, popupmsg: "" });

    } catch(err) {
        console.log(err)
        res.status(404).send("error retrieving products info")

    }
})

app.post("/wishlist/:id", async (req, res) => {
    const productId = req.params.id;

    if (!req.session.wishlist) {
        req.session.wishlist = [];
    }
    
    if (req.user) {
        const userId = req.user.id;

        try {
            await db.query(`INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)`, [userId, productId]);
            res.json({ success: true, message: "Product added to wishlist" });
        } catch (err) {
            console.log(err);
            res.json({ success: false, message: "An error occured" });
        }
    } else {
        const existing = req.session.wishlist.find(item => item.product_id === productId);

        if (existing) {
            res.json({ success: true, message: "Product already exists in wishlist" });
        } else {
            req.session.wishlist.push({ product_id: productId }); 
            res.json({ success: true, message: "Product added to wishlist" });
        }
    }
});

app.delete("/wishlist/:id", async(req, res) => {
    const productId = req.params.id;

    if (req.user) {
        const userId = req.user.id;
        try {
            await db.query(`DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2`,[userId, productId]);
            res.json({ success: true, message: "Product deleted from wishlist" });
        } catch(err) {
            console.log(err)
            res.json({ success: false, message: "An error occured" });
        }

    } else {
        req.session.wishlist = req.session.wishlist.filter(item => item.product_id !== productId);
        res.json({ success: true, message: "Product deleted from wishlist" });
    }

})

app.get("/edit-profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/sign-in");
  }

  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, address, city, state, country 
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    res.render("edit-profile.ejs", { user, msg: "", popupmsg: "" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching profile");
  }
});

app.post("/update-user-details", async (req, res) => {

  const { first_name, last_name, email, phone, address, city, state, country } = req.body;

  try {
    await db.query(
      `UPDATE users SET 
        first_name = $1,
        last_name = $2,
        email = $3,
        phone = $4,
        address = $5,
        city = $6,
        state = $7,
        country = $8
      WHERE id = $9`,
      [first_name, last_name, email, phone, address, city, state, country, req.user.id]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating profile");
  }
});

app.get("/admin", async(req, res) => {
  try {
    const result = await db.query("SELECT * FROM categories");
    const categories = result.rows;
    const msg = req.query.msg || null;

    const ordersResult = await db.query(`
      SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.delivery_location,
        o.created_at,
        d.name AS delivery_type,
        u.email,
        u.first_name,
        u.last_name
      FROM orders o
      JOIN delivery_options d ON o.delivery_option_id = d.id
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    const orders = ordersResult.rows;

    // Get items for each order
    for (let order of orders) {
      const itemsResult = await db.query(`
        SELECT 
          p.name,
          p.image,
          pv.size,
          oi.qty,
          oi.price
        FROM order_details oi
        JOIN product_variants pv ON oi.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;
    }

    res.render("admin", { msg, categories, orders, popupmsg: "" });

  } catch (err) {
    console.error("Admin page error:", err);
    res.render("admin", { msg: "Failed to load", categories: [], orders: [], popupmsg: "" });
  }
});

app.post("/admin/order/status", async (req, res) => {
  const { order_id, status } = req.body;
  try {
    await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2`,
      [status, order_id]
    );
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating order status");
  }
});

app.post("/new-category", async (req, res) => {
  const { category } = req.body;

  try {
    if (!category) {
      return res.redirect("/admin?msg=Input a category");
    }

    await db.query(
      "INSERT INTO categories (name) VALUES ($1)",
      [category.trim()]
    );

    res.redirect("/admin");
  } catch (err) {
    console.error("Unable to add category:", err);
    res.redirect("/admin?msg=Something went wrong");
  }
});

app.post("/upload", upload.single("product-img"), async(req, res) => {
    //product details
    const categoryId = req.body["category-id"];
    const productName = req.body["product-name"];
    const productDes = req.body["product-des"];
    const productPrice = req.body["product-price"];
    const imageUrl = `/uploads/${req.file.filename}`;
    const singleStock = req.body["single-stock"] || "";

    console.log(categoryId);
    console.log(productName);
    console.log(productDes);
    console.log(productPrice);
    console.log(imageUrl);
    console.log(singleStock);

    let productId
    //product query
    try {
        const result1 = await db.query(`
            INSERT INTO products (name, description, category_id, price, image)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [productName, productDes, categoryId, productPrice, imageUrl]
        );
        productId = result1.rows[0].id;
    } catch (err) {
        //any other error
        console.log("Insert failed:", err);

        //duplicate error
        if (err.code === '23505') { //check for duplicate
            console.log("Duplicate entry, fetching existing product...")
            try {
                const existing = await db.query(
                    `SELECT id FROM products 
                    WHERE name = $1 AND category_id = $2`,
                    [productName, categoryId]
                );
                if (existing.rowCount > 0) {
                    productId = existing.rows[0].id;
                }
            } catch (fetchErr) {
                console.log("Failed to fetch existing product:", fetchErr)
                return res.redirect("/admin?msg=Issue adding product to database") 
            }
        }
    }

    if (!productId) {
        console.log("productId is still undefined!");
        return res.redirect("/admin?msg=Issue adding product to database")
    }


    //variants details
    const sizeArray = [].concat(req.body.sizes || []); //['S', 'M', 'XL'] or ['S'] or []
    const stocks = [].concat(req.body.stock || []); //['10', '25', '5'] OR ['10'] or []
    const size = sizeArray.length ? sizeArray : ""; //checker for availability of size(variant)
    console.log(size);
    console.log(stocks)

    //variants query 
    if (size) {
        if (size.length !== stocks.length) {
                return res.redirect("/admin?msg=Mismatch: number of sizes, and stocks must match")
            }

        try {
            for (let i = 0; i < size.length; i++) {
                await db.query(`
                    INSERT INTO product_variants (product_id, size, stock)
                    VALUES ($1, $2, $3)
                    RETURNING id`,
                    [productId, size[i], stocks[i]]
                );
            } 
            console.log("sucess")
            res.redirect("/admin?msg=Product added sucessfully")
        } catch (err) {
            console.log(err);
            return res.redirect("/admin?msg=Issue adding product to database")
        }
          
    } else {
        try {
            await db.query(`
                INSERT INTO product_variants (product_id, size, stock)
                VALUES ($1, $2, $3)
                RETURNING id`,
                [productId, size, singleStock]
            );
            console.log("sucess")
            res.redirect("/admin?msg=Product added sucessfully")
        } catch (err) {
            console.log(err);
            return res.redirect("/admin?msg=Issue adding product to database")
        }

    }

})

passport.use(new Strategy (
    {
        usernameField: 'email',
        passwordField: 'password'
    },
    async function(email, password, done) {

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return done(null, false, { message: "Invalid email or password"});
        }
        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if(isMatch) {
            return done(null, user)
        } else {
            return done(null, false, { message: "Invalid email or password" })
        }
    } catch(err) {
        console.error('Authentication error:', err);
        return done(new Error('Authentication failed'))
    }
}))


passport.serializeUser((user, done) => {
    //only id is sent to the cookie
    done(null, user.id);
})


passport.deserializeUser(async (id, done) => {
    //only the id and email are stored in req.user
    try {
        const result = await db.query('SELECT id, email FROM users WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return done(null, false);
        }
        
        const user = result.rows[0];
        done(null, user);
    } catch(err) {
        console.error('Deserialization error:', err);
        done(err);
    }
})

// Initiate payment
app.post("/payment/initiate", async (req, res) => {
  const { first_name, last_name, delivery_type, within_lagos_location, address, city, state, country, is_save } = req.body;

    if (is_save) {
        await db.query(
            `UPDATE users SET first_name = $1, last_name = $2, phone = $3, address = $4, city = $5, state = $6, country = $7 WHERE id = $8`,
            [first_name, last_name, req.body.phone, address, city, state, country, req.user.id]
        );
    }

  const email = req.user.email;

  // Build delivery location string based on type
  let delivery_location = '';

  if (delivery_type === 'within_lagos') {
    delivery_location = within_lagos_location;
  } else if (delivery_type === 'outside_lagos') {
    delivery_location = `${address}, ${city}, ${state}, ${country}`;
  }

  try {
    // Get delivery option id and fee from DB
    const deliveryResult = await db.query(
      `SELECT id, fee FROM delivery_options WHERE name = $1`,
      [delivery_type]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(400).send("Invalid delivery type");
    }

    const { id: delivery_option_id, fee: shippingFee } = deliveryResult.rows[0];

    // Calculate total
    const subtotal = await calculateCartTotal(req.user.id);
    const total = subtotal + shippingFee;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: total * 100,
        metadata: { delivery_option_id, delivery_location },
        callback_url: "https://cs-lux-production.up.railway.app/payment/verify",
      },
      { headers: paystackHeaders }
    );

    const { authorization_url } = response.data.data;
    res.redirect(authorization_url);

  } catch (err) {
    console.error("Initiation error:", err.response?.data || err.message);
    res.status(500).send("Payment initiation failed");
  }
});

// Verify payment (Paystack redirects here after payment)
app.get("/payment/verify", async (req, res) => {
    const { reference } = req.query;

    try {
        // Check if order already exists for this reference
        const existingOrder = await db.query(
            `SELECT id FROM orders WHERE payment_reference = $1`,
            [reference]
        );

        if (existingOrder.rows.length > 0) {
            // Order already created, just render receipt
            const existingPayment = await db.query(
                `SELECT amount, status FROM payments WHERE reference = $1`,
                [reference]
            );
            const { amount, status } = existingPayment.rows[0];
            return res.render("receipt.ejs", { amount, reference, status, popupmsg: "" });
        }

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            { headers: paystackHeaders }
        );

        const { status, metadata } = response.data.data;
        const amount = parseInt(response.data.data.amount);

        await db.query(
            `INSERT INTO payments (user_id, amount, reference, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (reference) DO NOTHING`,
            [req.user.id, Math.floor(amount / 100), reference, status]
        );

        if (status === "success") {
            const cartResult = await db.query(
                `SELECT c.variant_id, c.qty, p.price
                    FROM cart c
                    JOIN product_variants pv ON c.variant_id = pv.id
                    JOIN products p ON pv.product_id = p.id
                    WHERE c.user_id = $1`,
                [req.user.id]
            );

            const cartItems = cartResult.rows;

            const orderResult = await db.query(
                `INSERT INTO orders (user_id, total_amount, payment_reference, status, delivery_option_id, delivery_location)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`,
                [req.user.id, Math.floor(amount / 100), reference, "processing", metadata.delivery_option_id, metadata.delivery_location]
            );

            const orderId = orderResult.rows[0].id;

            for (let item of cartItems) {
                await db.query(
                    `INSERT INTO order_details (order_id, variant_id, qty, price)
                    VALUES ($1, $2, $3, $4)`,
                    [orderId, item.variant_id, item.qty, parseInt(item.price)]
                );
            }

            await db.query(`DELETE FROM cart WHERE user_id = $1`, [req.user.id]);
        }

        res.render("receipt.ejs", { amount: Math.floor(amount / 100), reference, status, msg: "", popupmsg: "" });

    } catch (err) {
        console.error("Verification error:", err.response?.data || err.message);
        res.status(500).send("Payment verification failed");
    }
});

app.listen(PORT, () => {
    console.log(`app is running on port ${PORT}`)
});