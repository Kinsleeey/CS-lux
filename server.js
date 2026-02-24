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

env.config();
const { Pool } = pg;
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

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
const port = 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000*60*60*24
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.set('view engine', 'ejs');
app.set('views', './views')

const saltRounds = 3;

async function getProductPreviewDetails() {
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.price,
                c.name AS category,
                p.image
                FROM products p
                JOIN categories c ON p.category_id = c.id
            `)
            return result.rows;
        } catch (err) {
            console.error(err);
            return null;
        }
};

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

/*
async function getProductInfo(id) {
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.price
                p.description,
                c.name AS category,
                (SELECT image 
                FROM product_variants 
                WHERE product_id = p.id 
                ORDER BY id 
                LIMIT 1) as image
                pv.size,
                pv.color,
                pv.stock
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN product_variants pv ON p.id = pv.product_id
            WHERE p.id = $1
        `, [id]);
        
        return result.rows;
    } catch (err) {
        console.error(err);
        return null;  // or throw error, or return []
    }
}
*/

app.get("/", async(req, res) => {
    if(req.user) {
        console.log("Logged in")
        console.log(req.user);
    } else {
        console.log("Not Logged in")
    }
    try {
        const result1 = await db.query("SELECT * FROM categories");
        const categories =  result1.rows;

        
        const products = await getProductPreviewDetails();


        if(products.length === 0) {
            return res.render("index.ejs", { msg: "No Products Available", products: [], categories })
        }

        res.render("index.ejs", { msg: "", products, categories });

    } catch(err) {
        console.log(err)
        res.status(404).send("error retrieving Categories/product")

    }

})

app.get("/product", async(req, res) => {

    try {
        const result1 = await db.query("SELECT * FROM categories");
        const categories =  result1.rows;

        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.image,
                p.price
                FROM products p
                WHERE category_id = 1
            `, )
        
        const products = result.rows;

        let variants = [];
        const varArr = products.map(product => product.id);

        for (let v of varArr) {
            const variant = await getVariantDetails(v);    
            variants.push(variant);
        }

        if(products.length === 0) {
            return res.render("product.ejs", { msg: "No Products Available", products: [], categories, variants })
        }

        res.render("product.ejs", { msg: "", products, categories, variants });

    } catch(err) {
        console.log(err)
        res.status(404).send("error retrieving products info")

    }
})

app.get("/p-cat/:id", async(req, res) => {
    const specificId = req.params.id;
    const result1 = await db.query("SELECT * FROM categories");
        const categories =  result1.rows;

    const result = await db.query(`
        SELECT 
            p.id,
            p.name,
            p.price,
            p.image,
            p.price
            FROM products p
            WHERE category_id = $1
        `, [specificId])

    const products = result.rows;

    console.log(products)

    let variants = [];
    const varArr = products.map(product => product.id);
    

    for (let v of varArr) {
        const variant = await getVariantDetails(v);    
        variants.push(variant);
    }
    
    console.log(variants);
    if(products.length === 0) {
        return res.render("product.ejs", { msg: "No Products Available", products: [], categories })
    }
    res.render("product.ejs", { msg: "", products, categories, variants });

})

app.get("/sign-in", (req, res) => {
    res.render("sign-in.ejs", {msg: ""})
})

app.post("/login", 
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/sign-in',
    })
);

app.get("/sign-up", (req, res) => {
    res.render("sign-up", { msg: "" })
})

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

        req.login(newUser, (err) => {
            if (err) {
                console.error("Auto-login error:", err);
                return res.render("sign-up", { 
                    msg: "Registration successful! Please login." 
                });
            }
            res.redirect("/");
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
                p.image
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE c.name = $1`, [specifiedCategory]
    );

    const relatedProducts = result.rows;

    const product = await getProductDetails(specificId); 
    const variants = await getVariantDetails(specificId); 
    console.log(product)
    console.log(variants)
    
    res.render("info.ejs", { product: product[0], variants, relatedProducts })
})

app.get("/cart", async(req, res) => {
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

    res.render("cart.ejs", { cartedProducts }); 
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

        // Check if adding qty would exceed stock
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
    
    console.log("Cart count:", count);
    console.log(req.session.cart)
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

app.get("/checkout", (req, res) => {
    res.render("checkout.ejs")
})

app.get("/track-order", (req, res) => {
    res.render("track-order.ejs")
})

app.get("/wishlist", async(req, res) => {
    // add this at the top of the route
    if (!req.user) return res.redirect("/sign-in");
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.image,
                p.price
                FROM wishlist w
                JOIN products p ON w.product_id = p.id
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
            return res.render("wishlist.ejs", { msg: "No Products Available", products: [], variants })
        }

        return res.render("wishlist.ejs", { msg: "", products, variants });

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
        res.redirect("/sign-in")
    }

})

app.get("/edit-profile", (req, res) => {
    res.render("edit-profile.ejs")
})

app.get("/admin", async(req, res) => {
    try {
        const result = await db.query("SELECT * FROM categories");
        const categories =  result.rows;
        const msg = req.query.msg || null;

        if (categories.length === 0) {
            return res.render("admin", { msg: "Kindly create a new category", categories: [] });
        } 
        res.render("admin", { msg: msg, categories: categories})

    } catch (err) {
        console.error("Admin page error:", err);
        res.render("admin", {
        msg: "Failed to load categories",
        categories: []
        });
  }
})

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


app.listen(3000, () => {
    console.log(`app is running on port ${port}`)
});