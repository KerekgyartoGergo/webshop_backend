# SoundWawe
## A projektről

>A Soundwave egy lendületes és megbízható webshop, amely a minőségi hangzás szerelmeseit szolgálja ki. Legyen szó otthoni zenehallgatásról, stúdiófelvételekről vagy élő előadásokról, nálunk megtalálod a legjobb mikrofonokat, hangfalakat, fejhallgatókat és egyéb profi hangeszközöket. Válogatott kínálat, szakértői tanácsadás és szenvedély a hang iránt – a Soundwave-nél minden arról szól, hogy a hang élménnyé váljon. Fedezd fel a hullámokat, és találd meg a saját ritmusod!

---


## Készítette
- Kerékgyártó Gergő (Backend, SQL adatbázis, Frontend)
- Kovács Ákos (Frontend, SQL adatbázis)
- [GitHub repo (backend)](https://github.com/KerekgyartoGergo/webshop_backend.git)
- [GitHub repo (frontend)](https://github.com/KerekgyartoGergo/webshop_frontend.git)

---

### Fejlesztési környezet
- **Node.js**
- **MySQL**
- **Html**
- **CSS**
---

## Adatbázis

- users
    - user_id
    - user_name
    - email
    - psw
    - role

- carts
    - cart_id
    - user_id

- cart_items
    - cart_item_id
    - cart_id
    - product_id
    - quantity

- orders
    - order_id
    - user_id
    - order_date
    - status
    - tel
    - iranyitoszam
    - varos
    - cim

- order_items
    - id
    - order_id
    - product_id
    - quantity

- products
    - product_id
    - name
    - description
    - price
    - stock
    - category_id
    - pic
    - Jelátvitel
    - Max_működési_idő
    - Hordhatósági_változatok
    - Termék_típusa
    - Kivitel
    - Bluetooth_verzió
    - Hangszóró_meghajtók
    - Szín
    - Csatlakozók
    - Bluetooth
    - Frekvenciaátvitel
    - Érzékenység

- categories
    - category_id
    - name
    - description
 

![kép az adatbáziskapcsolatokról](https://snipboard.io/nXpNRr.jpg)
>[adatbázis diagram](https://drawsql.app/teams/dunder-mifflin-3/diagrams/soundwave)

## Backend

A backend Node.js alapú, Express keretrendszerrel, és MySQL adatbázissal működik. Feladata kommunikációs hidat létesíteni a frontend (weboldal) és az adatbázis között.


### Telepítés és futtatás
```bash
git clone https://github.com/KerekgyartoGergo/webshop_backend.git
cd webshop
npm install
npm run dev
```
---

### Mappa struktúra
- Backend/
    - node_modules/ 
        - ... -> *Használt csomagok fájljai*
    - uploads/ 
        - ... -> *Termékek képei*
    - middleware/
        - multer.middleware.js -> *Fájl feltöltés*
        - auth.middleware.js -> *Token autentikáció*
    - app.js -> *Szerver indítási fájl. Az alkalmazás belépési pontja (Express konfigurálás, middleware-ek betöltése)*
    - .env -> *Környezeti változók (pl. adatbázis URL, API kulcsok)*
    - package.json -> *Használt csomagok és függőségek*
    - package-lock.json -> *Függőségek*
    - ReadMe.md -> *Dokumentáció*
    - wrathhound.sql -> *Adatbázis*
 


---

### Használt package-ek
- [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- [cookie-parser](https://www.npmjs.com/package/cookie-parser)
- [cors](https://www.npmjs.com/package/cors)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [express](https://www.npmjs.com/package/express)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)
- [multer](https://www.npmjs.com/package/multer)
- [mysql2](https://www.npmjs.com/package/mysql2)
- [validator](https://www.npmjs.com/package/validator)
- [nodemon](https://www.npmjs.com/package/nodemon)
- [nodemailer](https://www.npmjs.com/package/nodemailer)



````javascript
"dependencies": {
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "expres": "^0.0.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.12.0",
    "nodemailer": "^6.10.0",
    "validator": "^13.12.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
````
>package.json



---  

### Biztonság
- **JWT** token alapú hitelesítés
- Jelszavak **bcryptjs** segítségével vannak hashelve
- Middleware szinten történik az authentikáció
- A **.env** fájl tartalmaz minden érzékeny adatot – ne oszd meg publikusan!
---


### Végpontok
Az app.js -be meghívtuk az összes routes fájlt és mint egy közlekedési csomópont igazgatja a végpontokat.
````javascript
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(cors({
    origin: 'http://127.0.0.1:5500', 
    credentials: true
}));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
````
>app.js


1. Végpontok

    | Művelet        | HTTP                                               | Végpont         | Leírás                                                                 |
    |----------------|----------------------------------------------------|-----------------|------------------------------------------------------------------------|
    | Regisztráció   | ![POST](https://img.shields.io/badge/-POST-yellow) | `/register`     | Új felhasználó regisztrálása                                           |
    | Bejelentkezés  | ![POST](https://img.shields.io/badge/-POST-yellow) | `/login`        | Felhasználó bejelentkezése                                             |
    | Kijelentkezés  | ![POST](https://img.shields.io/badge/-POST-yellow) | `/logout`       | Felhasználó kijelentkezése *(hitelesítés szükséges)*                      |
    | Ellenőrzés     | ![GET](https://img.shields.io/badge/-GET-green)    | `/logintest`     | Bejelentkezés ellenőrzése – igaz értéket ad vissza, ha be van jelentkezve |


    ```javascript
    app.post('/api/register',
    app.post('/api/login',
    app.post('/api/logout', authenticateToken,
    app.get('/api/logintest', authenticateToken,
    ```

    >app.js
    

2. User végpontok
    | Művelet                    | HTTP                                               | Végpont              | Leírás                                                                 |
    |----------------------------|----------------------------------------------------|----------------------|------------------------------------------------------------------------|
    | Saját profil lekérése      | ![GET](https://img.shields.io/badge/-GET-green)     | `/userprofile`       | A bejelentkezett felhasználó saját adatainak lekérése                 |
    | Más profil lekérése        | ![GET](https://img.shields.io/badge/-GET-green)     | `/userprofile/:uid`  | Más felhasználó adatainak lekérése a(z) UID alapján                     |
    | Profil szerkesztése        | ![PUT](https://img.shields.io/badge/-PUT-blue)   | `/editprofile`       | A felhasználó adatainak módosítása *(pl. felhasználónév, jelszó)*     |


    ```javascript
    router.get('/userprofile', authenticateToken, userprofile);
    router.get('/userprofile/:uid', anyuserprofile);
    router.put('/editprofile', authenticateToken, editprofile);
    ```

app.put('/api/editProfileName', authenticateToken,
app.put('/api/editProfilePsw', authenticateToken,
app.post('/api/adminRegister',
app.get('/api/products', authenticateToken,
app.get('/api/categories', authenticateToken,
app.get('/api/getProductsByCategory', authenticateToken,
app.get('/api/search/:searchQuery', authenticateToken,
app.get('/api/getCartItems', authenticateToken,
app.get('/api/getCartTotal', authenticateToken,
app.post('/api/addCart/', authenticateToken,
app.put('/api/updateCart/', authenticateToken,
app.post('/api/deleteCart', authenticateToken,
app.post('/api/addOrderWithItems', authenticateToken,
app.get('/api/my-orders', authenticateToken,
app.get('/api/getOrderTotal', authenticateToken,
app.get('/api/users', authenticateToken,
app.delete('/api/deleteUser', authenticateToken,
app.put('/api/updateUserRole', authenticateToken,
app.post('/api/addCategory',
app.post('/api/upload', authenticateToken,  upload.single('pic'),
app.delete('/api/deleteProduct/:id', authenticateToken,
app.delete('/api/deleteCategory/:id', authenticateToken,
app.get('/api/getItem', authenticateToken,
app.get('/api/category/:categoryId',
app.post('/api/updateItem', authenticateToken, upload.single('pic'),
app.post('/api/updateItemInfo', authenticateToken,
app.post('/api/updateCategory', authenticateToken,
app.get('/api/orders', authenticateToken,
app.put('/api/orders/:orderId', authenticateToken,
app.post('/api/send-email',





















