require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const app = express();
const port = 3000;

// Datenbank-Verbindung für MySQL einrichten
const db = mysql.createConnection({
  host: process.env.DB_HOST,  
  user: process.env.DB_USER,   
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,  
  port: process.env.DB_PORT,      
});

db.connect((err) => {
  if (err) {
    console.error("Datenbankverbindung fehlgeschlagen:", err);
    process.exit(1);
  }
  console.log("Mit MySQL verbunden!");
});

app.use(express.json());

// Route für /hello mit Query-Param
app.get("/hello", (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).send("Name fehlt");

  db.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "query"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send("Hallo mein query ist: " + name);
    }
  );
});

// Route für /hello/:name mit URL-Param
app.get("/hello/:name", (req, res) => {
  const name = req.params.name;

  db.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "param"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send("Hallo mein Name ist auch " + name);
    }
  );
});

// Route für POST /hello/body mit JSON
app.post("/hello/body", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send("JSON muss ein 'name'-Feld enthalten");

  db.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "body"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send({ message: "Name gespeichert", name });
    }
  );
});

// Neue Route: POST /person für das Hinzufügen einer Person
app.post("/person", (req, res) => {
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } =
    req.body;

  if (!vorname || !nachname || !email) {
    return res
      .status(400)
      .send("Vorname, Nachname und E-Mail sind erforderlich");
  }

  const query = `
    INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Fehler beim Einfügen der Person:", err);
      return res.status(500).send("Fehler beim Speichern der Person");
    }
    res
      .status(201)
      .send({ message: "Person hinzugefügt", id: result.insertId });
  });
});

// Neue Route: GET /person für das Abrufen aller Personen
app.get("/person", (req, res) => {
  db.query("SELECT * FROM personen", (err, results) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Personen");
    res.status(200).json(results);
  });
});

// Neue Route: GET /person/:id für das Abrufen einer Person nach ID
app.get("/person/:id", (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Person");
    if (result.length === 0)
      return res.status(404).send("Person nicht gefunden");
    res.status(200).json(result[0]);
  });
});

// Neue Route: DELETE /person/:id zum Löschen einer Person nach ID
app.delete("/person/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Löschen der Person");
    if (result.affectedRows === 0)
      return res.status(404).send("Person nicht gefunden");
    res.status(200).send("Person gelöscht");
  });
});

app.listen(port, () => {
  console.log(`Server läuft unter http://localhost:${port}`);
});
