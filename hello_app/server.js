require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const Ajv = require("ajv");
const ajvFormats = require("ajv-formats"); // Importiere ajv-formats

const app = express();
const port = 3000;

// Verbindungspool einrichten
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// AJV Setup
const ajv = new Ajv();
ajvFormats(ajv);  // Aktiviert alle Formate wie 'email', 'uri', etc.

// Schema für die Personendaten
const personSchema = {
  type: "object",
  properties: {
    vorname: { type: "string" },
    nachname: { type: "string" },
    plz: { type: "integer" },
    strasse: { type: "string" },
    ort: { type: "string" },
    telefonnummer: { type: "string" },
    email: { type: "string", format: "email" }  // E-Mail-Validierung
  },
  required: ["vorname", "nachname", "email"], // Vorname, Nachname und Email sind erforderlich
  additionalProperties: false
};

// Kompiliere das Schema
const validatePerson = ajv.compile(personSchema);

app.use(express.json());

// Middleware für JSON-Validierung
 
function validateSchema(schema) {
  const validate = ajv.compile(schema);
  return (req, res, next) => {
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({
        error: "Ungültiger JSON-Body",
        details: validate.errors,
      });
    }
    next();
  };
}
 

// POST /person zum Hinzufügen einer Person
app.post("/person", async (req, res) => {
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } =
    req.body;

  // Zusätzliche Validierung für PLZ und telefonnummer
  if (typeof plz !== "number" || isNaN(plz)) {
    return res.status(400).json({
      message: "PLZ muss eine Zahl sein",
    });
  }

  if (typeof telefonnummer !== "string" || telefonnummer.length < 10) {
    return res.status(400).json({
      message: "Telefonnummer muss als String mit mindestens 10 Zeichen übermittelt werden",
    });
  }

  try {
    // Person in die Datenbank einfügen
    const [result] = await pool.execute(
      `INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vorname, nachname, plz, strasse, ort, telefonnummer, email]
    );
    res.status(201).json({ message: "Person hinzugefügt", id: result.insertId });
  } catch (err) {
    console.error("Fehler beim Einfügen:", err);
    res.status(500).send("Datenbankfehler");
  }
});

// GET /person zum Abrufen aller Personen
app.get("/person", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM personen");
    res.json(rows);
  } catch (err) {
    res.status(500).send("Fehler beim Abrufen");
  }
});

// GET /person/:id zum Abrufen einer Person nach ID
app.get("/person/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM personen WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).send("Person nicht gefunden");
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send("Fehler beim Abrufen");
  }
});

// DELETE /person/:id zum Löschen einer Person nach ID
app.delete("/person/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM personen WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).send("Person nicht gefunden");
    res.send("Person gelöscht");
  } catch (err) {
    res.status(500).send("Fehler beim Löschen");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf http://localhost:${port}`);
});
