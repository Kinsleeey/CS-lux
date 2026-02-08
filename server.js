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

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();
env.config();
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


app.get("/", (req, res) => {
    res.render("index")
})

app.get("/product", (req, res) => {
    res.render("product.ejs", { productDetails: "" });
})

app.get("/cart", (req, res) => {
//more stuff
        res.render("cart.ejs") 
})

app.get("/sign-in", (req, res) => {
    res.render("sign-in.ejs", {msg: ""})
})

app.post("/login", 
     passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/sign-in',
    })
)

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

app.get("/info/:id", async(req, res) => {
    const id = req.params.id;

    //fetch data from db

    res.render("info.ejs")
})

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

app.get("/admin", (req, res) => {
    res.render("admin.ejs")
})

app.post("/upload",upload.single("product-img"), (req, res) => {
    const productDetail = {
        category: req.body.category,
        name: req.body["product-name"],
        description: req.body["product-des"],
        size: req.body.size,
        price: req.body["product-price"],
        image: '/uploads/' + req.file.filename
    };
    productDetails.push(productDetail);

    console.log(productDetail);

    res.redirect("/product");
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

//only id is sent to the cookie
passport.serializeUser((user, done) => {
    done(null, user.id);
})

//only the id and email are stored in req.user
passport.deserializeUser(async (id, done) => {
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