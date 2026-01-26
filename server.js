import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('views', './views')

app.get("/", (req, res) => {
    res.render("index.ejs")
})

app.get("/product", (req, res) => {
    res.render("product.ejs")
})

app.get("/cart", (req, res) => {
    res.render("cart.ejs")
})
app.get("/sign-in", (req, res) => {
    res.render("sign-in.ejs")
})
app.get("/sign-up", (req, res) => {
    res.render("sign-up.ejs")
})
app.get("/info", (req, res) => {
    res.render("info.ejs")
})
app.listen(3000, () => {
    console.log(`app is running on port ${port}`)
});