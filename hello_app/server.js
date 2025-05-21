require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const Ajv = require("ajv");
const ajvFormats = require("ajv-formats");

const app = express();
const port = 3000;
const TOKEN_SECRET = process.env.TOKEN_SECRET;

// MySQL-Datenbankverbindung
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(express.json());

// JSON-Validierung
const ajv = new Ajv();
ajvFormats(ajv);

const personSchema = {
  type: "object",
  properties: {
    vorname: { type: "string" },
    nachname: { type: "string" },
    plz: { type: "integer" },
    strasse: { type: "string" },
    ort: { type: "string" },
    telefonnummer: { type: "string", minLength: 10 },
    email: { type: "string", format: "email" }
  },
  required: ["vorname", "nachname", "email"],
  additionalProperties: false,
};

// Middleware: JSON-Validierung
function validateSchema(schema) {
  const validate = ajv.compile(schema);
  return (req, res, next) => {
    const valid = validate(req.body);
    if (!valid) {
      return res.status(200).json({ message: "Ungültiger JSON-Body", details: validate.errors });
    }
    next();
  };
}

// Token generieren
function generateAccessToken(username) {
  return jwt.sign(username, TOKEN_SECRET, { expiresIn: '1800s' });
}

// Middleware: Token prüfen
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(200).json({ message: "Kein Token gefunden" });

  jwt.verify(token, TOKEN_SECRET, (err, user) => {
    if (err) return res.status(200).json({ message: "Ungültiger Token" });
    req.user = user;
    next();
  });
}

// REGISTER
app.post('/user/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [existingUser] = await pool.query("SELECT * FROM user WHERE username = ?", [username]);
    if (existingUser.length > 0) {
      return res.status(200).json({ message: "Benutzername bereits vergeben" });
    }

    const [result] = await pool.execute(
      "INSERT INTO user (username, password) VALUES (?, ?)",
      [username, password]
    );

    const token = generateAccessToken({ username });
    res.status(200).json({ message: "Benutzer erstellt", token });
  } catch (err) {
    res.status(200).json({ message: "Datenbankfehler beim Registrieren", error: err.message });
  }
});

// LOGIN
app.post('/user/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [results] = await pool.query("SELECT * FROM user WHERE username = ? AND password = ?", [username, password]);

    if (results.length === 0) {
      return res.status(200).json({ message: "Benutzername oder Passwort falsch" });
    }

    const token = generateAccessToken({ username });
    res.status(200).json({ token, message: "Erfolgreich eingeloggt" });
  } catch (err) {
    res.status(200).json({ message: "Datenbankfehler beim Login", error: err.message });
  }
});

// POST /person
app.post("/person", authenticateToken, validateSchema(personSchema), async (req, res) => {
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = req.body;
  try {
    const [result] = await pool.execute(
      `INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vorname, nachname, plz, strasse, ort, telefonnummer, email]
    );
    res.status(200).json({ 
      message: "Person hinzugefügt", 
      id: result.insertId,
      data: { vorname, nachname, plz, strasse, ort, telefonnummer, email }
    });    
  } catch (err) {
    res.status(200).json({ 
      message: "Fehler beim Einfügen", 
      error: err.message,
      data: { vorname, nachname, plz, strasse, ort, telefonnummer, email }
    });
  }
});


// GET /person
app.get("/person", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM personen");
    res.status(200).json(rows);
  } catch (err) {
    res.status(200).json({ message: "Fehler beim Abrufen" });
  }
});

// GET /person/:id
app.get("/person/:id", authenticateToken, async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(200).json({ message: "Ungültige ID. Muss eine Ganzzahl sein." });
    }
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.query("SELECT * FROM personen WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(200).json({ message: "Person nicht gefunden" });
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(200).json({ message: "Fehler beim Abrufen", error: err.message });
  }
});

// PUT /person/:id
app.put("/person/:id", authenticateToken, validateSchema(personSchema), async (req, res) => {
  const id = req.params.id;

  // ID Check
  if (!/^\d+$/.test(id)) {
    return res.status(200).json({ message: "Ungültige ID in der URL", id });
  }

  const parsedId = parseInt(id, 10);
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE personen SET vorname = ?, nachname = ?, plz = ?, strasse = ?, ort = ?, telefonnummer = ?, email = ? WHERE id = ?`,
      [vorname, nachname, plz, strasse, ort, telefonnummer, email, parsedId]
    );

    if (result.affectedRows === 0) {
      return res.status(200).json({ message: "Person nicht gefunden", id: parsedId });
    }

    res.status(200).json({
      message: "Person aktualisiert",
      updated: { id: parsedId, vorname, nachname, plz, strasse, ort, telefonnummer, email }
    });
  } catch (err) {
    res.status(200).json({ message: "Fehler beim Aktualisieren", error: err.message, id: parsedId });
  }
});



// DELETE /person/:id
app.delete("/person/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;

  if (isNaN(id)) {
    return res.status(200).json({ message: "Ungültige ID. Muss eine Zahl sein." });
  }

  try {
    const [result] = await pool.query("DELETE FROM personen WHERE id = ?", [parseInt(id, 10)]);

    if (result.affectedRows === 0) {
      return res.status(200).json({ message: "Person nicht gefunden" });
    }

    res.status(200).json({ message: "Person gelöscht" });
  } catch (err) {
    res.status(200).json({ message: "Fehler beim Löschen", error: err.message });
  }
});


// Catch-All für ungültige Routen
app.use((req, res) => {
  res.status(200).json({ message: "Ungültige Route oder Methode" });
});

// Server starten
app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
