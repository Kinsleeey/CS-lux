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
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();

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

async function getProductDetails(id) {

    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.description,
                c.name AS category,
                p.price
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
                pv.size,
                pv.color,
                pv.image,
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

/*async function getProductDetails(id) {
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.description,
                c.name AS category,
                pv.size,
                pv.color,
                pv.image,
                pv.stock,
                pv.price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN product_variants pv ON p.id = pv.product_id
            WHERE p.id = $1
        `, [id]);
        /*
            returns array of object/objects.
            object = {
                id:
                name:
                description:
                category:
                size:
                color:
                image:
                stock:
                price
            }
        */
      /*  return result.rows;
    } catch (err) {
        console.error(err);
        return null;  // or throw error, or return []
    }
}*/

app.get("/", async(req, res) => {
    if(req.user) {
        console.log("Logged in")
    } else {
        console.log("Not Logged in")
    }
    try {
        const result1 = await db.query("SELECT * FROM categories");
        const categories =  result1.rows;

        const result2 = await db.query(
                `SELECT 
                    p.id,
                    p.name,
                    p.price,
                    c.name AS category,
                    (SELECT image 
                    FROM product_variants 
                    WHERE product_id = p.id 
                    ORDER BY id 
                    LIMIT 1) as image
                    FROM products p
                    JOIN categories c ON p.category_id = c.id`
        );
        const products = result2.rows; //array of object/objects


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
        const result = await db.query(
            `SELECT 
                p.id,
                p.name,
                p.price,
                c.name AS category,
                (SELECT image 
                FROM product_variants 
                WHERE product_id = p.id 
                ORDER BY id 
                LIMIT 1) as image
                FROM products p
                JOIN categories c ON p.category_id = c.id`
        );
        const products = result.rows; //array of object/objects
        
        if(products.length === 0) {
            return res.render("products.ejs", { msg: "No Products Available", products: [] })
        }
        res.render("product.ejs", { msg: "", products: products });

    } catch(err) {
        console.log(err)
        res.status(404).send("error retrieving products info")

    }
    

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
                (SELECT image 
                FROM product_variants 
                WHERE product_id = p.id 
                ORDER BY id 
                LIMIT 1) as image
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE c.name = $1`, [specifiedCategory]
    );

    const relatedProducts = result.rows;

    const product = await getProductDetails(specificId); // Single product object
    const variants = await getVariantDetails(specificId); // Array of variants
    


    res.render("info.ejs", { product: product[0], variants, relatedProducts })
})

app.get("/cart", async(req, res) => {
    if (req.user) {
        const result = await db.query()
    }
    res.render("cart.ejs") 
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

app.post("/cart/:id", async(req, res) => {
    const productId = req.params.id;
    
    // Initialize session cart if it doesn't exist
    if (!req.session.cart) {
        req.session.cart = [];
    }
    
    let count = 0;
    
    if (req.user) {
        // User is logged in - save to database
        const userId = req.user.id;
        await db.query("INSERT INTO cart(user_id, product_id) VALUES ($1, $2)", [userId, productId]);
        
        // Get cart count from database
        const result = await db.query("SELECT COUNT(*) FROM cart WHERE user_id = $1", [userId]);
        count = parseInt(result.rows[0].count);
    } else {
        // User not logged in - save to session
        req.session.cart.push({product_id: productId, qty: 1});
        count = req.session.cart.length;
    }
    
    console.log("Cart count:", count);
    console.log(req.session.cart)
    res.json({ success: true, count: count });
});

app.get("/checkout", (req, res) => {
    res.render("checkout.ejs")
})

app.get("/track-order", (req, res) => {
    res.render("track-order.ejs")
})

app.get("/wishlist", (req, res) => {
    res.render("wishlist.ejs")
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


app.post("/upload", upload.fields([
    {name: "product-img", maxCount: 1},
    {name: "product-img-by-color", maxCount: 5}
]), async(req, res) => {

    //products table data
    const categoryId = req.body.category;
    const pName = req.body["product-name"];
    const description = req.body["product-des"];
    const price = parseFloat(req.body["product-price"]) || 0; //decimal, numeriac(10,2) in db

    //product_variants table data
        //without color-image-stock vaiance
    const stock = parseInt(req.body.stock) || 0; //INT, int in db
    const noVarianceImage = (req.files["product-img"] && req.files["product-img"].length > 0) ? '/uploads/' + req.files["product-img"][0].filename : null; //string
    const size = (Array.isArray(req.body.size) ? (req.body.size).join(",") : req.body.size) || ""; //returns an array, optional size
    
    
        //with color-image-stock variance
    const colorArray = [].concat(req.body.color || []); //array of string/strings
    const color = colorArray.length ? colorArray : ""; //"" if empty
    const varianceImage = req.files["product-img-by-color"] ? req.files["product-img-by-color"].map(file => '/uploads/' + file.filename) : [] //array of strings/string
    const stockByColor = [].concat(req.body["stock-by-color"] || []).map(n => parseInt(n)); //array of int
;

    //products table query
    let productId;
    try {
        const result = await db.query("INSERT INTO products (name, description, category_id, price) VALUES ($1, $2, $3, $4) RETURNING id", [pName, description, categoryId, price]);
        productId = result.rows[0].id;
    } catch (err) {
        console.log("Insert failed:", err.message);
        
        try {
            const existing = await db.query("SELECT id FROM products WHERE name = $1 AND description = $2 AND category_id = $3 AND price = $4", [pName, description, categoryId, price]);
            
            if (!existing.rows[0]) {
                console.log("No existing product found");
                return res.status(500).send("Database error: product not found");
            }
            
            productId = existing.rows[0].id;
        } catch (selectErr) {
            console.log("Select failed:", selectErr.message);
            return res.status(500).send("Database error");
        }
    }

    if (!productId) {
        console.log("productId is still undefined!");
        return res.status(500).send("Failed to get product ID");
    }
        

        //product_variants table query
        if (color) {

            if (color.length !== varianceImage.length || color.length !== stockByColor.length) {
                return res.status(400).send('Mismatch: number of colors, images, and stocks must match');
            }
            try {
                for (let i = 0; i < color.length; i++) {
                    await db.query("INSERT INTO product_variants (product_id, size, color, image, stock) VALUES ($1, $2, $3, $4, $5) RETURNING id", [productId, size, color[i], varianceImage[i], stockByColor[i]])
                }
                return res.redirect("/product")
            } catch (err) {
                console.log(err)
                return res.status(400).send("error adding product details to database, check if product already exist");
            }
            
        } else {
            try {
                await db.query("INSERT INTO product_variants (product_id, size, color, image, stock) VALUES ($1, $2, $3, $4, $5) RETURNING id", [productId, size, color, noVarianceImage, stock])
                return res.redirect("/product")
            } catch(err) {
                console.log(err)
                return res.status(400).send("error adding product details to database");
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