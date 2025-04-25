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


## 1. Alap végpontok

| Művelet           | HTTP                                               | Végpont            | Leírás                                                                 |
|-------------------|----------------------------------------------------|--------------------|------------------------------------------------------------------------|
| Regisztráció      | ![POST](https://img.shields.io/badge/-POST-yellow) | `/register`        | Új felhasználó regisztrálása                                           |
| Bejelentkezés     | ![POST](https://img.shields.io/badge/-POST-yellow) | `/login`           | Felhasználó bejelentkezése                                             |
| Kijelentkezés     | ![POST](https://img.shields.io/badge/-POST-yellow) | `/logout`          | Felhasználó kijelentkezése *(hitelesítés szükséges)*                  |
| Ellenőrzés        | ![GET](https://img.shields.io/badge/-GET-green)    | `/logintest`       | Bejelentkezés ellenőrzése – igaz értéket ad vissza, ha be van jelentkezve |
| Admin regisztráció| ![POST](https://img.shields.io/badge/-POST-yellow) | `/adminRegister`   | Új Admin regisztrálása                                                 |

```javascript
app.post('/api/register',
app.post('/api/login',
app.post('/api/logout', authenticateToken,
app.get('/api/logintest', authenticateToken,
app.post('/api/adminRegister',
```

---

## 2. Felhasználói végpontok

| Művelet                    | HTTP                                               | Végpont              | Leírás                                 |
|----------------------------|----------------------------------------------------|----------------------|----------------------------------------|
| Profil név szerkesztése    | ![PUT](https://img.shields.io/badge/-PUT-blue)     | `/editProfileName`   | A felhasználó nevének módosítása       |
| Profil jelszó szerkesztése | ![PUT](https://img.shields.io/badge/-PUT-blue)     | `/editProfilePsw`    | A felhasználó jelszavának módosítása   |
| Felhasználók lekérése      | ![GET](https://img.shields.io/badge/-GET-green)    | `/users`             | Az összes felhasználó lekérése (admin) |
| Felhasználó törlése        | ![DELETE](https://img.shields.io/badge/-DELETE-red)| `/deleteUser`        | Felhasználó törlése (admin)            |
| Felhasználó szerep módosítás| ![PUT](https://img.shields.io/badge/-PUT-blue)    | `/updateUserRole`    | Felhasználó szerepének módosítása (admin) |

```javascript
app.put('/api/editProfileName', authenticateToken,
app.put('/api/editProfilePsw', authenticateToken,
app.get('/api/users', authenticateToken,
app.delete('/api/deleteUser', authenticateToken,
app.put('/api/updateUserRole', authenticateToken,
```

---

## 3. Termékek és kategóriák

| Művelet                        | HTTP                                               | Végpont                        | Leírás                                         |
|--------------------------------|----------------------------------------------------|--------------------------------|------------------------------------------------|
| Termékek lekérése              | ![GET](https://img.shields.io/badge/-GET-green)    | `/products`                    | Összes termék lekérdezése                      |
| Kategóriák lekérése            | ![GET](https://img.shields.io/badge/-GET-green)    | `/categories`                  | Összes kategória lekérdezése                   |
| Kategória alapú termékek       | ![GET](https://img.shields.io/badge/-GET-green)    | `/getProductsByCategory`       | Termékek lekérdezése kategória szerint         |
| Termék keresése                | ![GET](https://img.shields.io/badge/-GET-green)    | `/search/:searchQuery`         | Termék keresése kulcsszó alapján               |
| Termék adatainak lekérése      | ![GET](https://img.shields.io/badge/-GET-green)    | `/getItem`                     | Egy termék adatainak lekérése                  |
| Termék módosítása (kép+adat)   | ![POST](https://img.shields.io/badge/-POST-yellow) | `/updateItem`                  | Termék módosítása képpel                        |
| Termék adat módosítása         | ![POST](https://img.shields.io/badge/-POST-yellow) | `/updateItemInfo`              | Termék adatainak frissítése                    |
| Termék törlése                 | ![DELETE](https://img.shields.io/badge/-DELETE-red)| `/deleteProduct/:id`           | Termék törlése                                 |
| Kategória törlése              | ![DELETE](https://img.shields.io/badge/-DELETE-red)| `/deleteCategory/:id`          | Kategória törlése                              |
| Kategória módosítása           | ![POST](https://img.shields.io/badge/-POST-yellow) | `/updateCategory`              | Kategória adatainak módosítása                 |
| Kategória hozzáadása           | ![POST](https://img.shields.io/badge/-POST-yellow) | `/addCategory`                 | Új kategória hozzáadása                        |
| Kategória szerinti lekérdezés  | ![GET](https://img.shields.io/badge/-GET-green)    | `/category/:categoryId`        | Kategóriához tartozó adatok lekérése          |
| Kép feltöltés                  | ![POST](https://img.shields.io/badge/-POST-yellow) | `/upload`                      | Kép feltöltése                                 |

```javascript
app.get('/api/products', authenticateToken,
app.get('/api/categories', authenticateToken,
app.get('/api/getProductsByCategory', authenticateToken,
app.get('/api/search/:searchQuery', authenticateToken,
app.get('/api/getItem', authenticateToken,
app.post('/api/updateItem', authenticateToken, upload.single('pic'),
app.post('/api/updateItemInfo', authenticateToken,
app.delete('/api/deleteProduct/:id', authenticateToken,
app.delete('/api/deleteCategory/:id', authenticateToken,
app.post('/api/updateCategory', authenticateToken,
app.post('/api/addCategory',
app.get('/api/category/:categoryId',
app.post('/api/upload', authenticateToken, upload.single('pic'),
```

---

## 4. Kosár műveletek

| Művelet                  | HTTP                                               | Végpont            | Leírás                                   |
|--------------------------|----------------------------------------------------|--------------------|------------------------------------------|
| Kosár elemek lekérése    | ![GET](https://img.shields.io/badge/-GET-green)    | `/getCartItems`    | Kosárban lévő elemek lekérése            |
| Kosár összeg lekérése    | ![GET](https://img.shields.io/badge/-GET-green)    | `/getCartTotal`    | Kosár végösszeg lekérdezése              |
| Kosárhoz adás            | ![POST](https://img.shields.io/badge/-POST-yellow) | `/addCart`         | Termék hozzáadása a kosárhoz             |
| Kosár frissítése         | ![PUT](https://img.shields.io/badge/-PUT-blue)     | `/updateCart`      | Kosár tartalmának frissítése             |
| Kosárból törlés          | ![POST](https://img.shields.io/badge/-POST-yellow) | `/deleteCart`      | Kosár elem törlése                       |

```javascript
app.get('/api/getCartItems', authenticateToken,
app.get('/api/getCartTotal', authenticateToken,
app.post('/api/addCart/', authenticateToken,
app.put('/api/updateCart/', authenticateToken,
app.post('/api/deleteCart', authenticateToken,
```

---

## 5. Rendelések

| Művelet                       | HTTP                                               | Végpont                 | Leírás                                      |
|-------------------------------|----------------------------------------------------|--------------------------|---------------------------------------------|
| Rendelés létrehozása          | ![POST](https://img.shields.io/badge/-POST-yellow) | `/addOrderWithItems`     | Új rendelés létrehozása a kosár alapján     |
| Saját rendelések lekérése     | ![GET](https://img.shields.io/badge/-GET-green)    | `/my-orders`             | Bejelentkezett felhasználó rendelései       |
| Rendelés összeg lekérése      | ![GET](https://img.shields.io/badge/-GET-green)    | `/getOrderTotal`         | Egy rendelés végösszegének lekérdezése      |
| Összes rendelés lekérése      | ![GET](https://img.shields.io/badge/-GET-green)    | `/orders`                | Admin: összes rendelés lekérése             |
| Rendelés állapot módosítása   | ![PUT](https://img.shields.io/badge/-PUT-blue)     | `/orders/:orderId`       | Rendelés állapotának módosítása (admin)     |

```javascript
app.post('/api/addOrderWithItems', authenticateToken,
app.get('/api/my-orders', authenticateToken,
app.get('/api/getOrderTotal', authenticateToken,
app.get('/api/orders', authenticateToken,
app.put('/api/orders/:orderId', authenticateToken,
```

---

## 6. Egyéb

| Művelet           | HTTP                                               | Végpont          | Leírás                     |
|-------------------|----------------------------------------------------|------------------|----------------------------|
| E-mail küldés     | ![POST](https://img.shields.io/badge/-POST-yellow) | `/send-email`    | Automatikus e-mail küldése |

```javascript
app.post('/api/send-email',
```
