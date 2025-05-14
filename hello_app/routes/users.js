const express = require('express');
const router = express.Router();

// Route für alle Benutzer
router.get('/', (req, res) => {
  res.send('List of users');
});

// Route für spezifischen Benutzer
router.get('/:id', (req, res) => {
  const userId = req.params.id;
  res.send(`User with ID: ${userId}`);
});

// Neuen Benutzer erstellen
router.post('/', (req, res) => {
  const newUser = req.body;
  res.send(`New user created: ${JSON.stringify(newUser)}`);
});

// Benutzer aktualisieren
router.put('/:id', (req, res) => {
  const userId = req.params.id;
  const updatedUser = req.body;
  res.send(`User with ID: ${userId} updated with data: ${JSON.stringify(updatedUser)}`);
});

// Benutzer löschen
router.delete('/:id', (req, res) => {
  const userId = req.params.id;
  res.send(`User with ID: ${userId} deleted`);
});

module.exports = router;
