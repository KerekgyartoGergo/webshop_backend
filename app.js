const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const validator = require('validator');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { log, error } = require('console');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(cors({
    origin: 'http://127.0.0.1:5500', 
    credentials: true
}));
app.use(cookieParser());

// az uploads mappában lévő fájlok elérése
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



dotenv.config();
const PORT = process.env.PORT;
const HOSTNAME = process.env.HOSTNAME;

const pool = mysql.createPool({
    host: process.env.DB_HOST,  
    port: process.env.DB_PORT,         
    user: process.env.DB_USER,           
    password: process.env.DB_PASSWORD,   
    database: process.env.DB_DATABASE,   
    timezone: 'Z',                       
    waitForConnections: true,            
    connectionLimit: 10,                 
    queueLimit: 0                        
});


const uploadDir = 'uploads/';
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir)
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const now = new Date();
        const dateString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
        cb(null, `${dateString}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp|avif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if(extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Csak képformátumok megengedettek!'));       
        }
    }
});



const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(403).json({ error: 'Nincs token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Van token, csak épp nem érvényes' });
        }
        req.user = user;
        next();
    });
}


// API végpontok

// regisztráció
app.post('/api/register', (req, res) => {
    const { user_name, email, psw} = req.body;
    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push({ error: 'Nem valós email cím!' });
    }

    if (validator.isEmpty(user_name)) {
        errors.push({ error: 'Töltsd ki a nevet!' });
    }

    if (!validator.isLength(psw, { min: 6 })) {
        errors.push({ error: 'A jelszónak legalább 6 karakternek kell lennie!' });
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

  

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }



    bcrypt.hash(psw, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba a hashelés során!' });
        }
    
        // Először ellenőrizzük, hogy az email már szerepel-e az adatbázisban
        const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
        pool.query(checkEmailSql, [email], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Adatbázis hiba!' });
            }
            if (result.length > 0) {
                // Ha létezik már felhasználó ugyanazzal az emaillel
                return res.status(400).json({ error: 'Ez az email már regisztrálva van!' });
            }

    
            // Ha az email nem létezik, folytathatjuk a regisztrációval
            const sql = 'INSERT INTO users (user_id, user_name, email, psw, role) VALUES (NULL, ?, ?, ?, "user")';
            pool.query(sql, [user_name, email, hash], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Hiba az adatbázis művelet során!' });
                }                               
                
                // Új felhasználó user_id-ja
                const newUserId = result.insertId;
                
                // kosár létrehozása
                const sql2 = 'INSERT INTO carts (cart_id, user_id) VALUES (NULL, ?)';
                pool.query(sql2, [newUserId], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Hiba az új SQL-ben!' });
                    }
                    
                    res.status(201).json({ message: 'Sikeres regisztráció!, kosár létrehozva!' });
                });
            });
        });
    });
});


// a profile name szerkesztése
app.put('/api/editProfileName', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    const name = req.body.name;

    //console.log(user_id, name);
    const sql = 'UPDATE users SET user_name = COALESCE(NULLIF(?, ""), user_name) WHERE user_id = ?';

    pool.query(sql, [name, user_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben' });
        }

        return res.status(200).json({ message: 'Profil név módosítva' });
    });
});


// profil jelszó módosítása
app.put('/api/editProfilePsw', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    const psw = req.body.psw;
    const salt = 10;

    console.log(user_id, psw);
    if (psw === '' || !validator.isLength(psw, { min: 6 })) {
        return res.status(400).json({ error: 'A jelszónak min 6 karakterből kell állnia!' });
    }

    bcrypt.hash(psw, salt, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba a sózáskor!' });
        }

        const sql = 'UPDATE users SET psw = COALESCE(NULLIF(?, ""), psw) WHERE user_id = ?';

        pool.query(sql, [hash, user_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Hiba az SQL-ben' });
            }

            return res.status(200).json({ message: 'Jelszó módosítva! Most kijelentkeztetlek.' });
        });
    });
});


// login
app.post('/api/login', (req, res) => {
    const { email, psw } = req.body;
    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push({ error: 'Add meg az email címet '});
    }

    if (validator.isEmpty(psw)) {
        errors.push({ error: 'Add meg a jelszót' });
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const sql = 'SELECT * FROM users WHERE email LIKE ?';
    pool.query(sql, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'A felhasználó nem találató' });
        }

        const user = result[0];
        bcrypt.compare(psw, user.psw, (err, isMatch) => {
            if (isMatch) {

                // Ellenőrizzük, hogy admin-e
                const { role } = user;
               


                const token = jwt.sign({ id: user.user_id, role: role }, JWT_SECRET, { expiresIn: '1y' });
                
                res.cookie('auth_token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none',
                    maxAge: 1000 * 60 * 60 * 24 * 30 * 12
                });

                return res.status(200).json({ message: 'Sikeres bejelentkezés', role:role });
                
            } else {
                return res.status(401).json({ error: 'rossz a jelszó' });
            }
        });
    });
});

// logout
app.post('/api/logout', authenticateToken, (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    return res.status(200).json({ message: 'Sikeres kijelentkezés!' });
});

// tesztelés a jwt-re
app.get('/api/logintest', authenticateToken, (req, res) => {
    return res.status(200).json({ message: 'bent vagy' });
});




//admin fiók létrehozása
app.post('/api/adminRegister', (req, res) => {
    const { user_name, email, psw} = req.body;
    const errors = [];

    if (!validator.isEmail(email)) {
        errors.push({ error: 'Nem valós email cím!' });
    }

    if (validator.isEmpty(user_name)) {
        errors.push({ error: 'Töltsd ki a nevet!' });
    }

    if (!validator.isLength(psw, { min: 6 })) {
        errors.push({ error: 'A jelszónak legalább 6 karakternek kell lennie!' });
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }


    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }



    bcrypt.hash(psw, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba a hashelés során!' });
        }
    
        // Először ellenőrizzük, hogy az email már szerepel-e az adatbázisban
        const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
        pool.query(checkEmailSql, [email], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Adatbázis hiba!' });
            }
            if (result.length > 0) {
                // Ha létezik már felhasználó ugyanazzal az emaillel
                return res.status(400).json({ error: 'Ez az email már regisztrálva van!' });
            }

    
            // Ha az email nem létezik, folytathatjuk a regisztrációval
            const sql = 'INSERT INTO users (user_id, user_name, email, psw, role) VALUES (NULL, ?, ?, ?, "admin")';
            pool.query(sql, [user_name, email, hash], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Hiba az adatbázis művelet során!' });
                }                               
            
                    
                res.status(201).json({ message: 'Admin fiók létrehozva!' });
            });
        });
    });
});



// az összes termék lekérdezése
app.get('/api/products', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM products';

    pool.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincs még termék' });
        }

        return res.status(200).json(result);
    });
});

// az összes kategoria lekérdezése
app.get('/api/categories', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM categories';

    pool.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincs még termék' });
        }

        return res.status(200).json(result);
    });
});


//kosár tartalma szám
app.get('/api/getCartTotalQuantity', authenticateToken, (req, res) => {
    const getCartIdQuery = 'SELECT cart_id FROM carts WHERE user_id = ?';

    pool.query(getCartIdQuery, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (!cartResult || cartResult.length === 0) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }

        const cart_id = cartResult[0].cart_id;

        const getTotalQuantityQuery = 'SELECT SUM(quantity) AS total_quantity FROM cart_items WHERE cart_id = ?';

        pool.query(getTotalQuantityQuery, [cart_id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL-ben', err });
            }

            const totalQuantity = result[0].total_quantity || 0;
            return res.status(200).json({ total_quantity: totalQuantity });
        });
    });
});



//keresés a termékekben
app.get('/api/search/:searchQuery', authenticateToken, (req, res) => {
    const searchQuery = req.params.searchQuery;
    console.log(searchQuery);

    if (!searchQuery) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    const sqlQuery = `
    SELECT p.* 
    FROM products p
    JOIN categories c ON p.category_id = c.category_id
    WHERE p.name LIKE ? 
       OR p.description LIKE ? 
       OR p.pic LIKE ?
       OR p.Jelátvitel LIKE ?
       OR p.Max_működési_idő LIKE ?
       OR p.Hordhatósági_változatok LIKE ?
       OR p.Termék_típusa LIKE ?
       OR p.Kivitel LIKE ?
       OR p.Bluetooth_verzió LIKE ?
       OR p.Hangszóró_meghajtók LIKE ?
       OR p.Szín LIKE ?
       OR p.Csatlakozók LIKE ?
       OR p.Bluetooth LIKE ?
       OR p.Frekvenciaátvitel LIKE ?
       OR p.Érzékenység LIKE ?
       OR c.name LIKE ? 
       OR c.description LIKE ?
       `;
       const values = [
        `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, 
        `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, 
        `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, 
        `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, 
        `%${searchQuery}%`, `%${searchQuery}%`
    ];
    
    pool.query(sqlQuery, values, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log(results);
        res.json(results);
    });
});


app.get('/api/getProductsByCategory', authenticateToken, (req, res) => {
    // A kategória név lekérése a query stringből, pl. /api/getProductsByCategory?category=Elektronika
    const categoryName = req.query.category;
    if (!categoryName) {
        return res.status(400).json({ error: 'Kérlek add meg a kategória nevét!' });
    }

    const getProductsQuery = `
        SELECT p.* 
        FROM products p 
        JOIN categories c ON p.category_id = c.category_id 
        WHERE c.name LIKE ?;
    `;

    // A % operátorral részleges egyezést engedélyezünk a LIKE feltételben
    pool.query(getProductsQuery, [`%${categoryName}%`], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincs termék a megadott kategóriában' });
        }

        return res.status(200).json(result);
    });
});





// kosár tartalmának lekérdezése és termékek megjelenítése
app.get('/api/getCartItems', authenticateToken, (req, res) => {
    const getCartIdQuery = 'SELECT cart_id FROM carts WHERE user_id = ?';

    pool.query(getCartIdQuery, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (!cartResult || cartResult.length === 0) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }

        const cart_id = cartResult[0].cart_id;

        const getCartItemsQuery = `
            SELECT 
                ci.cart_item_id, 
                ci.cart_id, 
                ci.product_id, 
                ci.quantity, 
                p.name AS product_name, 
                p.description, 
                p.price, 
                p.stock, 
                p.pic AS product_image, 
                c.category_id, 
                c.name AS category_name 
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE ci.cart_id = ?`;

        pool.query(getCartItemsQuery, [cart_id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL-ben', err });
            }

            if (result.length === 0) {
                return res.status(404).json({ error: 'Nincsenek tételek a kosárban' });
            }

            return res.status(200).json(result);
        });
    });
});

//kosár végösszeg
app.get('/api/getCartTotal', authenticateToken, (req, res) => {
    const getCartIdQuery = 'SELECT cart_id FROM carts WHERE user_id = ?';

    pool.query(getCartIdQuery, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (!cartResult || cartResult.length === 0) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }

        const cart_id = cartResult[0].cart_id;

        const getCartTotalQuery = `
            SELECT 
                SUM(ci.quantity * p.price) AS total_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.product_id
            WHERE ci.cart_id = ?`;

        pool.query(getCartTotalQuery, [cart_id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL-ben', err });
            }

            if (result.length === 0 || result[0].total_price === null) {
                return res.status(404).json({ error: 'Nincsenek tételek a kosárban' });
            }

            return res.status(200).json({ total_price: result[0].total_price });
        });
    });
});




//kosárhoz ad
app.post('/api/addCart/', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ error: 'Adminnak nincs kosara' });
    }

    const { product_id, quantity } = req.body;

    if (!product_id || !quantity) {
        return res.status(400).json({ error: 'Minden mezőt ki kell tölteni' });
    }

    // Lekérdezzük a felhasználóhoz tartozó kosár azonosítót
    const getCartIdQuery = 'SELECT cart_id FROM carts WHERE user_id = ?';
    pool.query(getCartIdQuery, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (!cartResult || cartResult.length === 0) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }

        const cart_id = cartResult[0].cart_id;

        // Ellenőrizzük, hogy a termék már létezik-e a kosárban
        const checkProductQuery = 'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?';
        pool.query(checkProductQuery, [cart_id, product_id], (err, productResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
            }

            if (productResult.length > 0) {
                // Ha már van ilyen termék, növeljük a mennyiséget
                const newQuantity = productResult[0].quantity + quantity;
                const updateQuantityQuery = 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?';

                pool.query(updateQuantityQuery, [newQuantity, cart_id, product_id], (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
                    }
                    return res.status(200).json({ message: 'Termék mennyisége frissítve', product_id });
                });
            } else {
                // Ha nincs ilyen termék, beszúrjuk újként
                const insertCartItemQuery = 'INSERT INTO cart_items (cart_item_id, cart_id, product_id, quantity) VALUES (NULL, ?, ?, ?)';
                pool.query(insertCartItemQuery, [cart_id, product_id, quantity], (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
                    }
                    return res.status(201).json({ message: 'Termék kosárhoz adva', product_id: result.insertId });
                });
            }
        });
    });
});

//mennyiség frissítése
app.put('/api/updateCart/', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ error: 'Adminnak nincs kosara' });
    }

    const { product_id, quantity } = req.body;

    if (!product_id || !quantity || quantity < 1) {
        return res.status(400).json({ error: 'Érvényes termékazonosító és mennyiség szükséges' });
    }

    const getCartIdQuery = 'SELECT cart_id FROM carts WHERE user_id = ?';
    pool.query(getCartIdQuery, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (!cartResult.length) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }

        const cart_id = cartResult[0].cart_id;

        const updateQuantityQuery = 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?';
        pool.query(updateQuantityQuery, [quantity, cart_id, product_id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'A termék nem található a kosárban' });
            }

            return res.status(200).json({ message: 'Termék mennyisége frissítve', product_id, quantity });
        });
    });
});



//törlés a kosárból
app.post('/api/deleteCart', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ error: 'Adminnak nincs kosara' });
    }

    const { product_id, quantity } = req.body;

    if (!product_id){
        return res.status(400).json({ error: 'Minden mezőt ki kell tölteni' });
    }

    // Lekérdezzük a felhasználóhoz tartozó kosár azonosítót
    const getCartId = 'SELECT cart_id FROM carts WHERE user_id = ?';
    pool.query(getCartId, [req.user.id], (err, cartResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }
        console.log(req.user.id);
        
        // Ellenőrizzük, hogy van-e eredmény és hogy a cartResult nem üres tömb
        if (!cartResult || cartResult.length === 0) {
            return res.status(404).json({ error: 'Nincs kosár a felhasználóhoz' });
        }
    
        // Ellenőrizzük, hogy a cartResult[0] objektum tartalmazza-e a cart_id mezőt
        if (!cartResult[0].cart_id) {
            return res.status(500).json({ error: 'A kosár azonosítója nem található' });
        }
    
        const cart_id = cartResult[0].cart_id;

        // törlés
        const insertCartItemQuery = 'DELETE FROM cart_items WHERE cart_items.cart_id = ? AND cart_items.product_id = ?';
        pool.query(insertCartItemQuery, [cart_id, product_id, ], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
            }

            return res.status(204).json({ message: 'Termék törölve a kosárból'});
        }); 
    });
});

app.post('/api/addOrderWithItems', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ error: 'Admin nem adhat le rendelést' });
    }

    const { tel, iranyitoszam, varos, cim } = req.body;

    if (!tel || !iranyitoszam || !varos || !cim) {
        return res.status(400).json({ error: 'Minden mezőt ki kell tölteni' });
    }

    const getCartItemsQuery = `
        SELECT ci.product_id, ci.quantity, p.stock, p.name ,p.pic, p.price
        FROM cart_items ci 
        JOIN products p ON ci.product_id = p.product_id 
        JOIN carts c ON ci.cart_id = c.cart_id 
        WHERE c.user_id = ?`;

    pool.query(getCartItemsQuery, [req.user.id], (err, cartItems) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba a kosár lekérdezésekor' });
        }
        
        if (!cartItems.length) {
            return res.status(404).json({ error: 'Nincsenek termékek a kosárban' });
        }
        
        // Ellenőrizzük, hogy minden termékből van-e elég készlet
        
        console.log("asdasd",cartItems);
        let stockErrors = [];
        cartItems.forEach(item => {
            if (item.quantity > item.stock) {
                stockErrors.push(`${item.name} (Elérhető: ${item.stock} db)`);
            }
        });

        // Ha bármelyik termékből nincs elég, akkor nem engedjük leadni a rendelést
        if (stockErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Nincs elegendő készlet az alábbi termékekből:',
                details: stockErrors.join('\n')
            });
        }

        // Ha minden OK, beszúrjuk a rendelést
        const insertOrderQuery = `INSERT INTO orders (user_id, order_date, status, tel, iranyitoszam, varos, cim) 
                                  VALUES (?, current_timestamp(), ?, ?, ?, ?, ?)`;

        pool.query(insertOrderQuery, [req.user.id, 'pending', tel, iranyitoszam, varos, cim], (err, orderResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az order beszúrásakor' });
            }

            const order_id = orderResult.insertId;

            // Rendelt termékek beszúrása az order_items táblába
            const insertOrderItemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity) VALUES ?';
            const values = cartItems.map(item => [order_id, item.product_id, item.quantity]);

            pool.query(insertOrderItemsQuery, [values], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Hiba az order_items beszúrásánál' });
                }

                // ✅ Készletek frissítése
                const updateStockQuery = `
                    UPDATE products 
                    SET stock = stock - ? 
                    WHERE product_id = ?`;

                cartItems.forEach(item => {
                    pool.query(updateStockQuery, [item.quantity, item.product_id], (err) => {
                        if (err) console.error(`Hiba a készlet frissítésénél: ${err}`);
                    });
                });

                // ✅ Kosár törlése
                const deleteCartItemsQuery = 'DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM carts WHERE user_id = ?)';
                pool.query(deleteCartItemsQuery, [req.user.id], (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Hiba a kosár törlésekor' });
                    }
                });

                // ✅ E-mail küldés
                const userEmailQuery = 'SELECT email FROM users WHERE user_id = ?';
                pool.query(userEmailQuery, [req.user.id], (err, emailResult) => {
                    if (err || !emailResult.length) {
                        console.error(err);
                        return res.status(500).json({ error: 'Nem sikerült lekérni a felhasználó e-mail címét' });
                    }

                    const userEmail = emailResult[0].email;
                    const subject = 'Rendelés sikeresen leadva';
                    let productListHTML = cartItems.map((item, index) => {
                        const cid = `productImage${index}`;
                        return `
                            <li>
                                <b>${item.name}</b><br>
                                Ár: ${item.price} Ft<br>
                                Mennyiség: ${item.quantity}<br>
                                <img src="cid:${cid}" alt="${item.name}" width="100px" /><br>
                            </li>
                        `;
                    }).join('');

                    const text = `Kedves vásárló!\n\nKöszönjük, hogy nálunk vásárolt! A rendelés részletei:\n\nRendelési azonosító: ${order_id}\nTelefonszám: ${tel}\nCím: ${iranyitoszam}, ${varos}, ${cim}\n\nTermékek:\n${productListHTML}\n\nÜdvözlettel,\nA The Shop csapata`;

                    const attachments = cartItems.map((item, index) => ({
                        filename: `${item.name}.jpg`,  // A fájl neve
                        path: `./uploads/${item.pic}`,  // A fájl elérési útja a szerveren
                        cid: `productImage${index}`  // Egyedi Content-ID
                    }));

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'the.shop.orderinfo@gmail.com',
                            pass: process.env.EMAIL_PSW2,
                        }
                    });

                    const mailOptions = {
                        from: 'the.shop.orderinfo@gmail.com',
                        to: userEmail,
                        subject: subject,
                        html: `<p>Kedves vásárló!</p>
                               <p>Köszönjük, hogy nálunk vásárolt!</p>
                               <p>A rendelés részletei:</p>
                               <ul>
                                   <li><b>Rendelési azonosító:</b> ${order_id}</li>
                                   <li><b>Telefonszám:</b> ${tel}</li>
                                   <li><b>Cím:</b> ${iranyitoszam}, ${varos}, ${cim}</li>
                               </ul>
                               <p><b>Termékek:</b></p>
                               <ul>
                                   ${productListHTML}
                               </ul>
                               <p>Hamarosan értesítjük a szállítás részleteiről.</p>
                               <p>Üdvözlettel,<br><b>A The Shop csapata</b></p>`,
                        attachments: attachments,
                    };

                    transporter.sendMail(mailOptions, (err) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ error: 'Hiba történt az e-mail küldésekor' });
                        }

                        return res.status(201).json({ 
                            message: 'Rendelés sikeresen létrehozva, termékek hozzáadva és e-mail elküldve!', 
                            order_id: order_id, 
                            insertedRows: result.affectedRows 
                        });
                    });
                });
            });
        });
    });
});




//felhasználó rendelései
app.get('/api/my-orders', authenticateToken, (req, res) => {
    const userId = req.user.id; // Bejelentkezett felhasználó azonosítója

    const sql = `
        SELECT 
            o.order_id, 
            o.status,
            p.name, 
            p.pic, 
            p.price,
            oi.quantity
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        WHERE o.user_id = ?
    `;

    pool.query(sql, [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincsenek rendeléseid' });
        }

        return res.status(200).json(result);
    });
});


//felhasználó rendelései végösszeg

app.get('/api/getOrderTotal', authenticateToken, (req, res) => {
    const orderId = req.query.order_id; // A rendelés ID a query paraméterek között érkezik

    if (!orderId) {
        return res.status(400).json({ error: 'Nincs megadva rendelés azonosító' });
    }

    const getOrderTotalQuery = `
        SELECT 
            SUM(oi.quantity * p.price) AS total_price
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?`;

    pool.query(getOrderTotalQuery, [orderId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0 || result[0].total_price === null) {
            return res.status(404).json({ error: 'Nincsenek tételek a rendelésben' });
        }

        return res.status(200).json({ total_price: result[0].total_price });
    });
});













//admin parancsok



// az összes felhasználó lekérdezése
app.get('/api/users', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM users';

        // Ellenőrizzük, hogy a felhasználó admin-e
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Nincs jogosultság a törléshez' });
        }

    pool.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincs még termék' });
        }

        return res.status(200).json(result);
    });
});



//felhasználó törlése
app.delete('/api/deleteUser', authenticateToken, (req, res) => {
    const { user_id } = req.body;

    // Ellenőrizzük, hogy a felhasználó admin-e
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultság a törléshez' });
    }

    // SQL tranzakció indítása
    pool.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Adatbázis kapcsolat hiba' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error(err);
                return res.status(500).json({ error: 'Tranzakciós hiba' });
            }

            // 1. Töröljük a felhasználóhoz tartozó rendelési tételeket
            connection.query('DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE user_id = ?)', [user_id], (err) => {
                if (err) return rollbackTransaction(err, connection, res);
                console.log("Töröljük a felhasználóhoz tartozó rendelési tételeket");

                // 2. Töröljük a felhasználó rendeléseit
                connection.query('DELETE FROM orders WHERE user_id = ?', [user_id], (err) => {
                    if (err) return rollbackTransaction(err, connection, res);
                    console.log("Töröljük a felhasználó rendeléseit");

                    // 3. Töröljük a felhasználóhoz tartozó kosár elemeket
                    connection.query('DELETE FROM cart_items WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id = ?)', [user_id], (err) => {
                        if (err) return rollbackTransaction(err, connection, res);
                        console.log("Töröljük a felhasználóhoz tartozó kosár elemeket");

                        // 4. Töröljük a felhasználó kosarát
                        connection.query('DELETE FROM carts WHERE user_id = ?', [user_id], (err) => {
                            if (err) return rollbackTransaction(err, connection, res);
                            console.log("Töröljük a felhasználó kosarát");

                            // 5. Töröljük magát a felhasználót
                            connection.query('DELETE FROM users WHERE user_id = ?', [user_id], (err, result) => {
                                if (err) return rollbackTransaction(err, connection, res);
                                console.log("Töröljük magát a felhasználót");

                                if (result.affectedRows === 0) {
                                    return rollbackTransaction({ message: 'Felhasználó nem található' }, connection, res, 404);
                                }

                                // Ha minden sikeres, commit-oljuk a tranzakciót
                                connection.commit(err => {
                                    if (err) return rollbackTransaction(err, connection, res);
                                    connection.release();
                                    return res.status(204).send(); // Sikeres törlés
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
// Hibakezelő rollback függvény
function rollbackTransaction(err, connection, res, status = 500) {
    console.error(err);
    connection.rollback(() => {
        connection.release();
        res.status(status).json({ error: err.message || 'Hiba történt' });
    });
}


//user to admin
app.put('/api/updateUserRole', authenticateToken, (req, res) => {
    const { user_id } = req.body;

    // Ellenőrizzük, hogy a kérés indítója admin-e
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultság a módosításhoz' });
    }

    const sqlGetRole = 'SELECT role FROM users WHERE user_id = ?';
    pool.query(sqlGetRole, [user_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Felhasználó nem található' });
        }

        const currentRole = results[0].role;
        const newRole = currentRole === 'user' ? 'admin' : 'user';

        const sqlUpdateRole = 'UPDATE users SET role = ? WHERE user_id = ?';
        pool.query(sqlUpdateRole, [newRole, user_id], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
            }

            return res.status(200).json({ message: 'Szerepkör sikeresen frissítve', newRole });
        });
    });
});

//új kategoria hozzáadása
app.post('/api/addCategory', (req, res) => {
    const { name, description } = req.body;

    if (!name || !description) {
        return res.status(400).json({ error: 'Minden mezőt ki kell tölteni' });
    }

    const sql = 'INSERT INTO categories (category_id, name, description) VALUES (NULL, ?, ?)';
    pool.query(sql, [name, description], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        return res.status(201).json({ message: 'Kategória sikeresen hozzáadva', category_id: result.insertId });
    });
});



// új termek feltöltése
app.post('/api/upload', authenticateToken, upload.single('pic'), (req, res) => {


    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod termék feltöltésére' });
    }

    const pic = req.file ? req.file.filename : null;

    if (pic === null) {
        return res.status(400).json({ error: 'Válassz ki egy képet' });
    }

    const { name, description, price, stock, category_id } = req.body;

    if (!name || !description || !price || !stock || !category_id) {
        return res.status(400).json({ error: 'Minden mezőt ki kell tölteni' });
    }

    const sql = 'INSERT INTO products (product_id, name, description, price, stock, category_id, pic, Jelátvitel, Max_működési_idő, Hordhatósági_változatok, Termék_típusa, Kivitel, Bluetooth_verzió, Hangszóró_meghajtók, Szín, Csatlakozók, Bluetooth, Frekvenciaátvitel, Érzékenység) VALUES (NULL, ?, ?, ?, ?, ?, ?, "", "", "", "", "", "", "", "", "", "", "", "")';
    pool.query(sql, [name, description, price, stock, category_id, pic], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        return res.status(201).json({ message: 'Termék sikeresen feltöltve', product_id: result.insertId });
    });
});


app.delete('/api/deleteProduct/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod termék törlésére' });
    }

    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Adja meg a törölni kívánt termék ID-jét' });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Adatbázis kapcsolódási hiba:', err);
            return res.status(500).json({ error: 'Adatbázis kapcsolódási hiba' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error('Tranzakció indítási hiba:', err);
                return res.status(500).json({ error: 'Tranzakció indítási hiba' });
            }

            // Törlés az order_items táblából
            const deleteOrderItemsSql = 'DELETE FROM order_items WHERE product_id = ?';
            connection.query(deleteOrderItemsSql, [id], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error('Hiba a kapcsolódó rendelési elemek törlésében:', err);
                        res.status(500).json({ error: 'Hiba a kapcsolódó rendelési elemek törlésében' });
                    });
                }

                // Törlés a card_items táblából
                const deleteCardItemsSql = 'DELETE FROM cart_items WHERE product_id = ?';
                connection.query(deleteCardItemsSql, [id], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error('Hiba a kapcsolódó kosár elemek törlésében:', err);
                            res.status(500).json({ error: 'Hiba a kapcsolódó kosár elemek törlésében' });
                        });
                    }

                    // Törlés a products táblából
                    const deleteProductSql = 'DELETE FROM products WHERE product_id = ?';
                    connection.query(deleteProductSql, [id], (err, result) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Hiba a termék törlésében:', err);
                                res.status(500).json({ error: 'Hiba a termék törlésében' });
                            });
                        }

                        if (result.affectedRows === 0) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(404).json({ error: 'A megadott ID-vel nem található termék' });
                            });
                        }

                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('Tranzakció véglegesítési hiba:', err);
                                    res.status(500).json({ error: 'Tranzakció véglegesítési hiba' });
                                });
                            }

                            connection.release();
                            res.status(200).json({ message: 'Termék és kapcsolódó elemek sikeresen törölve' });
                        });
                    });
                });
            });
        });
    });
});

//kategoria törlése
app.delete('/api/deleteCategory/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod kategória törlésére' });
    }

    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Adja meg a törölni kívánt kategória ID-jét' });
    }

    const sql = 'DELETE FROM categories WHERE category_id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'A megadott ID-vel nem található kategória' });
        }

        return res.status(200).json({ message: 'Kategória sikeresen törölve' });
    });
});


//egy termék lekérdezése
app.get('/api/getItem', authenticateToken, (req, res) => {
    const { id } = req.query; // Módosítás: req.body helyett req.query

    if (!id) {
        return res.status(400).json({ error: 'Az ID megadása kötelező' });
    }

    const sql = 'SELECT * FROM products WHERE product_id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error('SQL hiba:', err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'A termék nem található' });
        }

        return res.status(200).json(result[0]);
    });
});


//egy kategoria lekérdezése
app.get('/api/category/:categoryId', (req, res) => {
    const categoryId = req.params.categoryId;

    // SQL lekérdezés a kategória adatainak lekérésére
    const sql = 'SELECT category_id, name, description FROM categories WHERE category_id = ?';

    pool.query(sql, [categoryId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Kategória nem található' });
        }

        return res.status(200).json({ category: result[0] });
    });
});


//termék szerkesztése
app.post('/api/updateItem', authenticateToken, upload.single('pic'), (req, res) => {


    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod termék feltöltésére' });
    }

    const pic = req.file ? req.file.filename : null;


    
    const { name, description, price, stock, category_id, id } = req.body;
    
    if(!id){
        return res.status(403).json({ error: 'adj meg egy id-t' });

    }

    const sql = 'UPDATE products SET name = COALESCE(NULLIF(?, ""), name), description = COALESCE(NULLIF(?, ""), description), price = COALESCE(NULLIF(?, ""), price), stock = COALESCE(NULLIF(?, ""), stock), category_id = COALESCE(NULLIF(?, ""), category_id), pic = COALESCE(NULLIF(?, ""), pic) WHERE products.product_id = ?';

    pool.query(sql, [name, description, price, stock, category_id, pic, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        return res.status(201).json({ message: 'Termék sikeresen frissítve', product_id: result.insertId });
    });
});
 //termék szerkesztése2

 app.post('/api/updateItemInfo', authenticateToken, (req, res) => {

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod termék frissítésére' });
    }

    const {
        Jelátvitel,
        Max_működési_idő,
        Hordhatósági_változatok,
        Termék_típusa,
        Kivitel,
        Bluetooth_verzió,
        Hangszóró_meghajtók,
        Szín,
        Csatlakozók,
        Bluetooth,
        Frekvenciaátvitel,
        Érzékenység,
    } = req.body;

    const id = req.body.id

    console.log(id);

    if (!id) {
        return res.status(403).json({ error: 'Adj meg egy id-t' });
    }

    const sql = `
      UPDATE products SET 
        Jelátvitel = COALESCE(NULLIF(?, ""), Jelátvitel), 
        Max_működési_idő = COALESCE(NULLIF(?, ""), Max_működési_idő), 
        Hordhatósági_változatok = COALESCE(NULLIF(?, ""), Hordhatósági_változatok), 
        Termék_típusa = COALESCE(NULLIF(?, ""), Termék_típusa), 
        Kivitel = COALESCE(NULLIF(?, ""), Kivitel), 
        Bluetooth_verzió = COALESCE(NULLIF(?, ""), Bluetooth_verzió), 
        Hangszóró_meghajtók = COALESCE(NULLIF(?, ""), Hangszóró_meghajtók), 
        Szín = COALESCE(NULLIF(?, ""), Szín), 
        Csatlakozók = COALESCE(NULLIF(?, ""), Csatlakozók), 
        Bluetooth = COALESCE(NULLIF(?, ""), Bluetooth), 
        Frekvenciaátvitel = COALESCE(NULLIF(?, ""), Frekvenciaátvitel), 
        Érzékenység = COALESCE(NULLIF(?, ""), Érzékenység) 
      WHERE product_id = ?;
    `;

    pool.query(sql, [
        Jelátvitel, Max_működési_idő, Hordhatósági_változatok, Termék_típusa, 
        Kivitel, Bluetooth_verzió, Hangszóró_meghajtók, Szín, 
        Csatlakozók, Bluetooth, Frekvenciaátvitel, Érzékenység, id
    ], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        return res.status(200).json({ message: 'Termék sikeresen frissítve' });
    });
});

    




// Kategória szerkesztése
app.post('/api/updateCategory', authenticateToken, (req, res) => {
    console.log(req.body);
    const { cat_id, edit_categorie_name, edit_categorie_description } = req.body; 

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultságod kategória szerkesztésére' });
    }

    //const { name, description, id } = req.body;
    
    if (!cat_id) {
        return res.status(400).json({ error: 'Kategória ID szükséges' });
        
    }

    const sql = 'UPDATE categories SET name = COALESCE(NULLIF(?, ""), name), description = COALESCE(NULLIF(?, ""), description) WHERE category_id = ?';

    pool.query(sql, [edit_categorie_name, edit_categorie_description, cat_id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Hiba az SQL lekérdezésben' });
        }

        return res.status(200).json({ message: 'Kategória sikeresen frissítve', category_id: result.insertId });
    });
});




// az összes rendelés lekérdezése
app.get('/api/orders', authenticateToken, (req, res) => {
    // Ellenőrizzük, hogy a felhasználó admin-e
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultság a megtekintéshez' });
    }

    const sql = `
        SELECT 
            o.order_id, 
            u.user_id, 
            u.user_name, 
            u.email, 
            o.status,
            p.product_id, 
            p.name, 
            p.stock, 
            p.pic, 
            oi.quantity
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
    `;

    pool.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Nincs még rendelés' });
        }

        return res.status(200).json(result);
    });
});



app.put('/api/orders/:orderId', authenticateToken, (req, res) => {
    const { orderId } = req.params;  // A rendelés azonosítója
    const { status } = req.body;     // A frissítendő státusz

    // Ellenőrizzük, hogy a felhasználó admin-e
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Nincs jogosultság a rendelés szerkesztéséhez' });
    }

    // Ellenőrizzük, hogy a státusz megfelelő értékkel rendelkezik
    const validStatuses = ['pending', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Érvénytelen státusz érték' });
    }

    // Az SQL lekérdezés a rendelés státuszának frissítésére
    const sql = `
        UPDATE orders
        SET status = ?
        WHERE order_id = ?
    `;

    // Az SQL lekérdezés végrehajtása
    pool.query(sql, [status, orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Hiba az SQL-ben', err });
        }

        // Ha nincs érintett sor, akkor a rendelés nem létezik
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Rendelés nem található' });
        }

        // E-mail küldés a felhasználónak a státusz frissítéséről
        const userEmailQuery = 'SELECT email FROM users WHERE user_id = (SELECT user_id FROM orders WHERE order_id = ?)';
        pool.query(userEmailQuery, [orderId], (err, emailResult) => {
            if (err || !emailResult.length) {
                console.error(err);
                return res.status(500).json({ error: 'Nem sikerült lekérni a felhasználó e-mail címét' });
            }

            const userEmail = emailResult[0].email;
            const subject = 'Rendelés státusz frissítve';
            const text = `Kedves vásárló!\n\nA rendelésed státusza frissült: ${status}.\n\nÜdvözlettel,\nA The Shop csapata`;

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'the.shop.orderinfo@gmail.com',
                    pass: process.env.EMAIL_PSW2,
                }
            });

            const mailOptions = {
                from: 'the.shop.orderinfo@gmail.com',
                to: userEmail,
                subject: subject,
                html: `<p>Kedves vásárló!</p>
                       <p>A rendelésed státusza frissült: <b>${status}</b>.</p>
                       <p>Üdvözlettel,<br><b>A The Shop csapata</b></p>`
            };

            transporter.sendMail(mailOptions, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Hiba történt az e-mail küldésekor' });
                }

                return res.status(200).json({ 
                    success: true, 
                    message: 'Rendelés státusza frissítve és e-mail elküldve!' 
                });
            });
        });
    });
});















//email küldés

const EMAIL_PSW = process.env.EMAIL_PSW;

app.post('/api/send-email', async (req, res) => {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
        return res.status(400).json({ error: 'Hiányzó mezők: to, subject, text' });
    }

    // Nodemailer konfiguráció
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'the.shop.orderinfo@gmail.com',
            pass: EMAIL_PSW 
        }
    });

    const mailOptions = {
        from: 'the.shop.orderinfo@gmail.com',
        to,
        subject,
        text
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        res.json({ message: 'E-mail elküldve!', info });
    } catch (error) {
        res.status(500).json({ error: 'Hiba történt az e-mail küldésekor', details: error.message });
    }
});



app.listen(PORT, () => {
    console.log(`IP: https://${HOSTNAME}:${PORT}`);
});