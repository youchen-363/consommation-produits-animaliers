"use strict";

// arrondit les nombres à une décimale maximum, avec une virgule en français
const formatNombre = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const formaterNombreSelonValeur = (nombre, formater = formatNombre.format) =>
  formater(nombre > 100 ? Math.round(nombre) : nombre);
