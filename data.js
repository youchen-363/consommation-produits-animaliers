"use strict";

// Couleurs des viandes partagées par tous les graphes, pour qu'une viande garde la même couleur d'un onglet à l'autre
// en cherchant des couleurs bien distinctes pour les différentes courbes je suis tombé sur ca https://sronpersonalpages.nl/~pault/
const COULEURS_VIANDES = {
  bovine: "#4477aa",
  porcine: "#228833",
  volaille: "#ccbb44",
  "ovine-caprine": "#ee6677",
  autres: "#bbbbbb"
};

async function chargerDonneesConsommation() {
  // Lit le CSV et convertit les colonnes variable et value en nombres (doc ici https://d3js.org/d3-fetch#csv)
  const lignesCsv = await d3.csv("./data/graph1.csv", (ligne) => {
    return {
      categorie: ligne.categorie,
      annee: Number(ligne.variable),
      quantite: ligne.value === "" ? null : Number(ligne.value)
    };
  });

  if (lignesCsv.length === 0) {
    throw new Error("Le fichier graph1.csv est vide :(");
  }

  // Récupère les années présentes dans le fichier, sans doublons et dans l'ordre
  const annees = Array.from(new Set(lignesCsv.map((ligne) => ligne.annee)))
    .sort((anneePrecedente, anneeSuivante) => anneePrecedente - anneeSuivante);

  // Associe les noms du CSV aux catégories et couleurs du graphe
  const consommation = [
    {
      id: "bovine",
      nom: "Bovine",
      nomCsv: "Bovins",
      couleur: COULEURS_VIANDES["bovine"]
    },
    {
      id: "porcine",
      nom: "Porcine",
      nomCsv: "Porcs",
      couleur: COULEURS_VIANDES["porcine"]
    },
    {
      id: "volaille",
      nom: "Volaille",
      nomCsv: "Volailles",
      couleur: COULEURS_VIANDES["volaille"]
    },
    {
      id: "ovine-caprine",
      nom: "Ovine et caprine",
      nomCsv: "Ovins et caprins",
      couleur: COULEURS_VIANDES["ovine-caprine"]
    },
    {
      id: "autres",
      nom: "Autres",
      nomCsv: "Autres viandes",
      couleur: COULEURS_VIANDES["autres"]
    }
  ];

  for (const categorie of consommation) {
    categorie.valeurs = annees.map((annee) => {
      const observation = lignesCsv.find((ligne) => {
        return ligne.categorie === categorie.nomCsv && ligne.annee === annee;
      });
      return observation ? observation.quantite : null;
    });
  }

  // Le CSV ne contient pas de total donc on additionne les cinq catégories par année nous meme
  const valeursTotal = annees.map((annee, indexAnnee) => {
    const valeursAnnee = consommation.map((categorie) => categorie.valeurs[indexAnnee]);

    return valeursAnnee.includes(null) ? null : d3.sum(valeursAnnee);
  });

  consommation.unshift({
    id: "total",
    nom: "Total",
    couleur: "black",
    valeurs: valeursTotal
  });

  return { annees, consommation };
}

async function chargerDonneesEcartPrixRevenus() {
  // on charge les deux CSV en parallèle et convertit leurs valeurs en nombres
  const [prix, revenus] = await Promise.all([
    d3.csv("data/prix_viande_france.csv", (ligne) => {
      return {
        annee: Number(ligne.annee),
        variation: Number(ligne.variation_prix_pct) 
      };
    }),
    d3.csv("data/revenus_france.csv", (ligne) => {
      return {
        annee: Number(ligne.annee),
        variation: Number(ligne.variation_revenu_nominal_uc_pct)
      };
    })
  ]);

  const donneesFinales = [];

  for (const prixAnnee of prix) {
    // Cherche le revenu de la même année sans se baser sur l'ordre des lignes
    const revenuAnnee = revenus.find((revenu) => revenu.annee === prixAnnee.annee);

    if (!revenuAnnee ||
      !Number.isFinite(prixAnnee.variation) ||
      !Number.isFinite(revenuAnnee.variation)) {
      continue;
    }

    donneesFinales.push({
      annee: prixAnnee.annee,
      variation_prix_pct: prixAnnee.variation,
      variation_revenu_nominal_uc_pct: revenuAnnee.variation,
      ecart_points: prixAnnee.variation - revenuAnnee.variation
    });
  }

  return donneesFinales.sort((anneePrecedente, anneeSuivante) => {
    return anneePrecedente.annee - anneeSuivante.annee;
  });
}

chargerDonneesEcartPrixRevenus().then((data) => console.log(data))

async function chargerDonneesImportations() {
  // Lit le CSV produit par graph3/preparer_taux_import.py et convertit l'année et le taux en nombres
  const lignesCsv = await d3.csv("data/taux_importation.csv", (ligne) => {
    return {
      annee: Number(ligne.annee),
      categorieCsv: ligne.categorie,
      taux: ligne.taux_importe === "" ? null : Number(ligne.taux_importe)
    };
  });

  if (lignesCsv.length === 0) {
    throw new Error("Le fichier taux_importation.csv est vide :(");
  }

  // Associe les noms du CSV aux catégories du site, avec les mêmes couleurs que le graphe de consommation
  // (la feuille Agreste "HistoViandesOvinesCaprines" regroupe ovins et caprins, d'où l'id ovine-caprine)
  const categories = [
    { id: "bovine", nom: "Bovine", nomCsv: "bovine" },
    { id: "porcine", nom: "Porcine", nomCsv: "porcine" },
    { id: "volaille", nom: "Volaille", nomCsv: "volaille" },
    { id: "ovine-caprine", nom: "Ovine et caprine*", nomCourt: "Ovine*", nomCsv: "ovine" }
  ];

  for (const categorie of categories) {
    categorie.couleur = COULEURS_VIANDES[categorie.id];
  }

  const annees = Array.from(new Set(lignesCsv.map((ligne) => ligne.annee)))
    .sort((anneePrecedente, anneeSuivante) => anneePrecedente - anneeSuivante);

  // une observation par année et par catégorie, en ignorant les lignes sans taux valide
  const observations = [];
  for (const ligne of lignesCsv) {
    const categorie = categories.find((categorie) => categorie.nomCsv === ligne.categorieCsv);

    if (!categorie || !Number.isFinite(ligne.taux)) {
      continue;
    }

    observations.push({
      annee: ligne.annee,
      taux: ligne.taux,
      idCategorie: categorie.id,
      nomCategorie: categorie.nom,
      couleur: categorie.couleur
    });
  }

  return { annees, categories, observations };
}